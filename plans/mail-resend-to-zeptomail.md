# Resend → Zoho ZeptoMail

Written 2026-09-07.

## The good news: this is a one-function change

Every email in the app funnels through a single private `send()` in
`src/services/mailer.client.ts` — 7 call sites, all inside that one file:

```
sendContactEmail        sendSupportTicketEmail   sendCouponEmail
sendOrderEmails         sendOrderCancelledEmail  sendOrderMilestoneEmail
```

Nothing outside the mailer knows which provider is used. Swapping Resend for ZeptoMail means
rewriting the body of `send()` and nothing else. The templates, the shell, `esc()`, `rupee()`
and all six senders stay exactly as they are.

## Use the HTTP API, not SMTP

The file's own comment says *"Railway's outbound SMTP block only lifts on the Pro plan and
above, so that's the fallback to restore if this project ever moves off Hobby and back to
SMTP."* We are on Pro now, so SMTP may work — but use the **HTTP API** anyway:

- It sidesteps the question entirely, and keeps working if Railway's egress policy changes
- It matches the existing shape exactly: one `fetch`, no connection pooling, no socket
  timeouts, no `nodemailer` dependency
- The dead `cfgSmtp` / `transport` / `sendSmtp` block at the bottom of the file can then be
  **deleted** rather than revived

ZeptoMail offers both. There is no advantage to SMTP here.

## ⚠ Use the India data centre

The MX records are `mx.zoho.in` — the Zoho account is on the **India** DC. ZeptoMail's console,
API host and keys are per-DC and **mixing them fails with confusing auth errors**. Everything
must be the `.in` variant. Confirm the exact API host and header format from the ZeptoMail
console rather than from memory or a blog post.

## The real work is DNS, not code

And there is a pre-existing mess to clean up first. Verified 2026-09-07 by resolving them:

```
hostingermail-a._domainkey    TXT=0  CNAME=0  A-answers=1
hostingermail-b._domainkey    TXT=0  CNAME=0  A-answers=1
hostingermail-c._domainkey    TXT=0  CNAME=0  A-answers=1
```

Two faults at once:

1. **They are 🟠 Proxied in Cloudflare.** A DKIM record must resolve through to a TXT value;
   Cloudflare is answering with its own proxy IPs instead. **DKIM is broken right now.** Same
   for `autoconfig` and `autodiscover`, which are also proxied.
2. **They are Hostinger records while the MX is Zoho.** Almost certainly stale from a previous
   mail host.

### Steps

1. **Add the domain in ZeptoMail** and complete domain verification.
2. **Add ZeptoMail's DKIM record** exactly as its console gives it, set to ⚪ **DNS only**.
   Getting this wrong in the same way as the existing records is the single most likely
   failure — proxying a DKIM record silently breaks it, with no error anywhere.
3. **Update SPF** to include ZeptoMail. One `TXT` record for the domain, one `v=spf1`, all
   senders in it — a second SPF record invalidates both.
4. **Delete the three stale `hostingermail-*._domainkey` records**, or flip them DNS-only if
   Hostinger still sends anything. They currently do nothing but look configured.
5. **Add DMARC** if absent. Optional, but with SPF and DKIM correct it is nearly free and it is
   what makes Gmail trust the domain.
6. Verify with a real send to a Gmail address and read `Authentication-Results` in the raw
   headers: expect `spf=pass` and `dkim=pass` for `adoughcookie.com`.

## Code changes

1. **`send()`** — POST to ZeptoMail instead of Resend. Keep every existing guard: the early
   return on no recipient, the `MAIL_USER` check (that blank-sender bug cost weeks of silent
   failures), and the same log lines so a failure still says which subject was skipped.
2. **New env vars** on both backend services: the ZeptoMail API key, and the API host.
   `MAIL_USER` and `BUSINESS_EMAIL` stay as they are.
3. **Keep `RESEND_API_KEY` set** during the transition. Have `send()` prefer ZeptoMail and fall
   back to Resend when the ZeptoMail key is absent — that makes staging and production
   switchable one variable at a time, and rollback is deleting one variable.
4. **Delete the dead SMTP block** once ZeptoMail is proven.

## ⚠ ZeptoMail is transactional-only

Zoho separates them deliberately: **ZeptoMail is for transactional mail and its terms prohibit
bulk/marketing sending.** Everything the app sends today qualifies — order confirmations,
delivery milestones, cancellations, contact replies, support tickets, coupon rewards.

But the plan for **marketing to the 127 imported contacts** does **not**. Sending a promotional
blast through ZeptoMail risks the account, and the account is also what delivers order
confirmations. Marketing needs a separate service (Zoho Campaigns) and, separately, a consent
record — there is still no opt-in column in the database.

## Rollout

1. DNS first, and verify DKIM/SPF actually pass before touching code
2. Staging: set the ZeptoMail vars, send one of each email type, check the raw headers
3. Production: set the vars, watch the first real order confirmation
4. Remove `RESEND_API_KEY` and delete the SMTP block after a week of clean sends

## Definition of done

- A real order confirmation arrives in Gmail with `spf=pass` and `dkim=pass`
- Nothing lands in spam
- `[mailer]` logs show no skips
- The dead SMTP code and the stale Hostinger DKIM records are both gone
