#!/usr/bin/env node
/*
 * Tell customers they may need to sign in again, once, for the sign-in changeover.
 *
 *   node scripts/notify-resignin.mjs            # DRY RUN — lists who would be mailed, sends nothing
 *   node scripts/notify-resignin.mjs --send     # actually sends
 *
 * DRY RUN IS THE DEFAULT and the --send flag is not optional politeness: this mails real
 * customers, there is no undo, and a script that sends on an accidental invocation is a script
 * that will one day send twice.
 *
 * WHO. Every account with a Supabase auth identity gets signed out when the JWT branch goes, so
 * the audience is "everyone who could still be holding a session" rather than a recent-activity
 * slice. Addresses come from OUR users table, never from auth.users -- most of those are the
 * synthetic phone_<digits>@phone.adccookies.app addresses we mint for the OTP bridge, and mailing
 * one would bounce off a domain that does not accept mail.
 *
 * NOT EVERYONE CAN BE REACHED. Accounts with no email at all are reported separately and get no
 * notice, because there is no channel: WhatsApp is unconfigured and Message Central sends OTPs
 * only. They will simply meet the login screen. Better to know the number than to imagine it is
 * zero.
 *
 * Run it AFTER the auth deploy. "You may have been signed out" is true then; sent beforehand it
 * warns about something that has not happened, and anyone who acts on it by signing in gets
 * signed out again half an hour later.
 */
import 'dotenv/config';
import pg from 'pg';
import { sendReSignInNotice } from '../dist/services/mailer.client.js';

const SEND = process.argv.includes('--send');
/* ZeptoMail is comfortable well above this, so the pause is not about their limits -- it is so a
   run that starts going wrong can be caught and killed before it has reached everybody. */
const GAP_MS = 400;

const { DATABASE_URL, ZEPTOMAIL_API_KEY } = process.env;
if (!DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(1); }
if (SEND && !ZEPTOMAIL_API_KEY) { console.error('ZEPTOMAIL_API_KEY is not set — nothing would send.'); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });

const SYNTHETIC = "u.email LIKE 'phone\\_%@phone.adccookies.app'";

const { rows } = await pool.query(`
  SELECT u.id, u.name, u.email
    FROM users u
   WHERE u.supabase_user_id IS NOT NULL
     AND u.email IS NOT NULL
     AND NOT (${SYNTHETIC})
   ORDER BY u.id`);

const { rows: [unreachable] } = await pool.query(`
  SELECT count(*)::int AS n
    FROM users u
   WHERE u.supabase_user_id IS NOT NULL
     AND (u.email IS NULL OR ${SYNTHETIC})`);

console.log(`${SEND ? 'SENDING' : 'DRY RUN'} — ${rows.length} mailable, ${unreachable.n} with no usable address`);
if (!SEND) {
  for (const r of rows) console.log(`  would mail  ${String(r.id).padStart(4)}  ${r.email}  (${r.name || 'no name'})`);
  console.log(`\n${rows.length} would be mailed. Re-run with --send to actually send.`);
  await pool.end();
  process.exit(0);
}

let ok = 0, failed = 0;
for (const r of rows) {
  try {
    await sendReSignInNotice({ to: r.email, name: r.name });
    ok++;
    console.log(`  sent  ${r.email}`);
  } catch (e) {
    failed++;
    console.error(`  FAILED  ${r.email} — ${e?.message || e}`);
    /* Stop rather than grind through the whole list. Ten in a row is a broken key or a blocked
       domain, not ten unlucky addresses, and the rest of the list is better left unsent than
       burned against a fault nobody is watching. */
    if (failed >= 10 && ok === 0) { console.error('\nTen failures and no successes — stopping.'); break; }
  }
  await new Promise((res) => setTimeout(res, GAP_MS));
}

console.log(`\nsent ${ok}, failed ${failed}, unreachable ${unreachable.n}`);
await pool.end();
