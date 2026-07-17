import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query, nowIso } from '../db.js';
import { ApiError } from '../middleware.js';
import { sendContactEmail } from '../mailer.js';

const router = Router();

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));

// Public + unauthenticated, so this is a bot-spam magnet. Rate-limit hard per IP —
// a genuine visitor never sends more than a couple of enquiries an hour.
const contactLimiter = rateLimit({
  windowMs: 60 * 60_000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many messages', message: 'Too many messages sent — please try again later.' },
});

// Public — visitors submit their details so ADC can get back to them.
router.post('/', contactLimiter, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const phone = req.body?.phone ? String(req.body.phone).trim() : null;
  const message = String(req.body?.message || '').trim();
  // Honeypot: a field real visitors never see or fill (hidden off-screen on the form).
  // Bots that auto-fill every input trip it — silently accept without emailing/storing.
  const honeypot = String(req.body?.company || '').trim();
  if (honeypot) { res.status(201).json({ ok: true, id: 0 }); return; }

  if (!name) throw new ApiError('Name is required');
  if (!isEmail(email)) throw new ApiError('A valid email is required');
  if (!message) throw new ApiError('Message is required');

  const { rows: [row] } = await query(
    `INSERT INTO contact_messages (name, email, phone, message, created_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name, email, phone, message, nowIso()]
  );

  // Notify the business by email (best-effort — never blocks the response on failure).
  await sendContactEmail({ name, email, phone, message });

  res.status(201).json({ ok: true, id: row.id });
});

export default router;
