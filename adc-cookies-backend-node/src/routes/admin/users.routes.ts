import { Router } from 'express';
import { getOne, getAll, nowIso } from '../../db/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { serializeAddress, serializeUser } from '../../serializers/index.js';
import { normalizePhone } from '../../services/messageCentral.client.js';
import { adminClient, supabaseConfigured } from '../../config/supabase.js';

const router = Router();

/* ---------- Users ---------- */
router.get('/users', async (_req, res) => {
  // Customers only — admin accounts are separated out and never listed here.
  const rows = await getAll("SELECT * FROM users WHERE role <> 'ADMIN' ORDER BY id DESC");
  const withCounts = await Promise.all(rows.map(async (u) => {
    const { c } = (await getOne('SELECT COUNT(*) AS c FROM orders WHERE user_id = $1', [u.id]))!;
    // Their saved delivery addresses (default first) so the Customers tab can show where they order from.
    const addrs = await getAll('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC', [u.id]);
    return { ...serializeUser(u), orderCount: Number(c), addresses: addrs.map(serializeAddress) };
  }));
  res.json(withCounts);
});

/*
 * Correct a customer's details by hand — a misheard name, a wrong digit in the number the rider
 * will call.
 *
 * Name and phone only. Email is deliberately NOT editable here, and phone is refused for accounts
 * that sign in with it, because both are the JOIN KEY between Supabase's auth record and this
 * table: syncUser() in middleware.js resolves an authenticated identity with
 * `SELECT * FROM users WHERE email = $1` (or `WHERE phone = $1` for OTP accounts) and CREATES A
 * ROW when it finds none. Editing the key an account signs in with therefore does not rename that
 * customer — it strands them, and hands them a fresh empty account, with their orders and saved
 * addresses left behind on the old row. A customer changes their own email from their account
 * page, where Supabase is updated in the same breath.
 */
router.put('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const user = await getOne("SELECT * FROM users WHERE id = $1 AND role <> 'ADMIN'", [id]);
  if (!user) throw new ApiError('Customer not found');

  const sets: any[] = [];
  const params: any[] = [];
  let i = 1;
  let newPhone: any = null;

  if (req.body?.name !== undefined) {
    const name = String(req.body.name || '').trim();
    if (name.length < 2) throw new ApiError('Enter the customer’s full name (at least 2 characters).');
    sets.push(`name = $${i++}`); params.push(name);
  }

  if (req.body?.phone !== undefined) {
    const raw = String(req.body.phone ?? '').trim();
    // No email means this is a phone-OTP account, and the number IS the login.
    if (!user.email) {
      throw new ApiError('This customer signs in with their phone number, so it is their login — changing it here would separate them from their own orders. Ask them to update it from their account page.');
    }
    if (!raw) {
      sets.push(`phone = $${i++}`); params.push(null);
    } else {
      const p = normalizePhone(raw);
      if (!p) throw new ApiError('Enter a valid 10-digit mobile number.');
      newPhone = p.digits;
      /* The customer-facing version of this merges the two accounts on a collision. An admin
         fixing a typo must never trigger that silently — a slip of the finger would fold a
         stranger's orders into this customer's history, and there is no undo. Refuse and say whose. */
      const taken = await getOne('SELECT id, name FROM users WHERE phone = $1 AND id <> $2', [newPhone, id]);
      if (taken) throw new ApiError(`${newPhone} is already on another account (${taken.name || `customer #${taken.id}`}).`);
      sets.push(`phone = $${i++}`); params.push(newPhone);
    }
  }

  if (!sets.length) throw new ApiError('Nothing to update.');

  sets.push(`updated_at = $${i++}`); params.push(nowIso());
  params.push(id);
  const row = await getOne(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params);
  console.log(`[ADMIN] customer updated | id=${id} | ${[
    req.body?.name !== undefined ? `name="${row!.name}"` : null,
    req.body?.phone !== undefined ? `phone=${row!.phone || 'cleared'}` : null,
  ].filter(Boolean).join(' | ')}`);

  // Mirror into Supabase so the customer's own account page shows the correction too. Best-effort,
  // exactly as the self-serve profile update does — never block the response on it.
  try {
    if (supabaseConfigured()) {
      const meta: Record<string, any> = {};
      if (req.body?.name !== undefined) meta.full_name = row!.name;
      if (newPhone) meta.phone = newPhone;
      const su = row!.email ? await getOne('SELECT id FROM auth.users WHERE email = $1', [row!.email]).catch(() => null) : null;
      if (su && Object.keys(meta).length) await adminClient().auth.admin.updateUserById(su.id, { user_metadata: meta });
    }
  } catch { /* metadata sync is non-critical */ }

  const { c } = (await getOne('SELECT COUNT(*) AS c FROM orders WHERE user_id = $1', [id]))!;
  const addrs = await getAll('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC', [id]);
  res.json({ ...serializeUser(row), orderCount: Number(c), addresses: addrs.map(serializeAddress) });
});

export default router;
