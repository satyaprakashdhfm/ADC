import { Router } from 'express';
import { getOne, getAll } from '../../db/index.js';
import { ApiError } from '../../utils/ApiError.js';

const router = Router();

/* ---------- Contact messages ---------- */
router.get('/contact', async (_req, res) => {
  const rows = await getAll('SELECT * FROM contact_messages ORDER BY id DESC');
  res.json(rows.map(m => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, message: m.message, handled: !!m.handled, createdAt: m.created_at })));
});

router.patch('/contact/:id/handled', async (req, res) => {
  const row = await getOne('UPDATE contact_messages SET handled = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
  if (!row) throw new ApiError('Message not found');
  res.json({ id: row.id, handled: !!row.handled });
});

/* ---------- Support tickets (raised from the chat) ---------- */
/*
 * These live beside contact messages because they are the same job to whoever is on the other end:
 * somebody wants something a person has to do. They arrive here rather than being acted on because
 * the assistant has no authority to cancel, refund or change an order — raising one of these IS its
 * answer to every such request.
 */
router.get('/tickets', async (req, res) => {
  const status = String(req.query.status || '').toUpperCase();
  const rows = await getAll(
    `SELECT t.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
            o.order_number, o.order_status, o.total_amount
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN orders o ON o.id = t.order_id
      WHERE ($1 = '' OR t.status = $1)
      ORDER BY (t.status = 'OPEN') DESC, t.id DESC
      LIMIT 200`,
    [status],
  );
  res.json(rows.map((t) => ({
    id: t.id,
    subject: t.subject,
    details: t.details,
    category: t.category,
    status: t.status,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    customer: { name: t.customer_name, email: t.customer_email, phone: t.customer_phone },
    order: t.order_number
      ? { orderNumber: t.order_number, orderStatus: t.order_status, totalAmount: t.total_amount }
      : null,
    /* The turns that led here, so whoever picks it up can see what was actually asked rather than
       only the one line the model summarised it into. */
    transcript: Array.isArray(t.transcript) ? t.transcript : [],
  })));
});

router.patch('/tickets/:id/status', async (req, res) => {
  const next = String(req.body?.status || '').toUpperCase();
  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(next)) {
    throw new ApiError('Status must be OPEN, IN_PROGRESS or RESOLVED.');
  }
  const row = await getOne(
    'UPDATE support_tickets SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status',
    [next, req.params.id],
  );
  if (!row) throw new ApiError('Ticket not found');
  res.json({ id: row.id, status: row.status });
});

export default router;
