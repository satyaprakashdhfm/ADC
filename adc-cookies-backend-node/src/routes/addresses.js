import { Router } from 'express';
import { getOne, getAll, query } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeAddress } from '../serializers.js';

const router = Router();
router.use(requireAuth);

async function userByEmail(email) {
  const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) throw new ApiError('User not found');
  return user;
}

router.get('/', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const rows = await getAll('SELECT * FROM addresses WHERE user_id = $1 ORDER BY id', [user.id]);
  res.json(rows.map(serializeAddress));
});

router.post('/', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const b = req.body || {};

  if (b.isDefault) {
    await query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [user.id]);
  }

  const row = await getOne(
    `INSERT INTO addresses
       (user_id, full_name, phone, address_line1, address_line2, city, state, pincode, latitude, longitude, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [user.id, b.fullName, b.phone, b.addressLine1, b.addressLine2 ?? null,
     b.city, b.state, b.pincode, b.latitude ?? null, b.longitude ?? null, !!b.isDefault]
  );
  res.json(serializeAddress(row));
});

router.delete('/:id', async (req, res) => {
  await query('DELETE FROM addresses WHERE id = $1', [req.params.id]);
  res.status(200).end();
});

export default router;
