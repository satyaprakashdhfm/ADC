import { Router } from 'express';
import { query, nowIso } from '../db.js';
import { ApiError } from '../middleware.js';

const router = Router();

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));

// Public — visitors submit their details so ADC can get back to them.
router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const phone = req.body?.phone ? String(req.body.phone).trim() : null;
  const message = String(req.body?.message || '').trim();

  if (!name) throw new ApiError('Name is required');
  if (!isEmail(email)) throw new ApiError('A valid email is required');
  if (!message) throw new ApiError('Message is required');

  const { rows: [row] } = await query(
    `INSERT INTO contact_messages (name, email, phone, message, created_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name, email, phone, message, nowIso()]
  );

  res.status(201).json({ ok: true, id: row.id });
});

export default router;
