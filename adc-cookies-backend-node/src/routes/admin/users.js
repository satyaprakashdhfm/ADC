import { Router } from 'express';
import { getOne, getAll } from '../../db.js';
import { serializeAddress, serializeUser } from '../../serializers.js';

const router = Router();

/* ---------- Users ---------- */
router.get('/users', async (_req, res) => {
  // Customers only — admin accounts are separated out and never listed here.
  const rows = await getAll("SELECT * FROM users WHERE role <> 'ADMIN' ORDER BY id DESC");
  const withCounts = await Promise.all(rows.map(async (u) => {
    const { c } = await getOne('SELECT COUNT(*) AS c FROM orders WHERE user_id = $1', [u.id]);
    // Their saved delivery addresses (default first) so the Customers tab can show where they order from.
    const addrs = await getAll('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC', [u.id]);
    return { ...serializeUser(u), orderCount: Number(c), addresses: addrs.map(serializeAddress) };
  }));
  res.json(withCounts);
});

export default router;
