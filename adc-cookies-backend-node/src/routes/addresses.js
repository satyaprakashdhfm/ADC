import { Router } from 'express';
import { getOne, getAll, query } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeAddress } from '../serializers.js';

const router = Router();
router.use(requireAuth);

// Normalize city/state to a consistent Title Case so analytics group cleanly
// ("bengaluru", "BENGALURU", "Bengaluru" all become "Bengaluru"). Comes from typed
// input or the detect-location reverse geocode, so normalize at the single write point.
export const titleCase = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Map common alternate city names to the canonical one (matches what reverse-geocode returns).
export const CITY_ALIASES = {
  Bangalore: 'Bengaluru', Bombay: 'Mumbai', Calcutta: 'Kolkata', Madras: 'Chennai',
  Gurgaon: 'Gurugram', Trivandrum: 'Thiruvananthapuram', Pondicherry: 'Puducherry', Vizag: 'Visakhapatnam',
};
export const canonicalCity = (s) => { const t = titleCase(s); return CITY_ALIASES[t] || t; };

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
       (user_id, full_name, phone, address_line1, address_line2, city, state, pincode, latitude, longitude, is_default, label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [user.id, b.fullName, b.phone, b.addressLine1, b.addressLine2 ?? null,
     canonicalCity(b.city), titleCase(b.state), b.pincode, b.latitude ?? null, b.longitude ?? null, !!b.isDefault, b.label || 'Home']
  );
  res.json(serializeAddress(row));
});

router.put('/:id', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const existing = await getOne('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!existing) throw new ApiError('Address not found', 404);
  const b = req.body || {};

  if (b.isDefault) {
    await query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [user.id]);
  }

  const row = await getOne(
    `UPDATE addresses SET
       full_name=$1, phone=$2, address_line1=$3, address_line2=$4,
       city=$5, state=$6, pincode=$7, is_default=$8, label=$9
     WHERE id=$10 AND user_id=$11 RETURNING *`,
    [b.fullName, b.phone, b.addressLine1, b.addressLine2 ?? null,
     canonicalCity(b.city), titleCase(b.state), b.pincode, !!b.isDefault, b.label || 'Home',
     req.params.id, user.id]
  );
  res.json(serializeAddress(row));
});

router.delete('/:id', async (req, res) => {
  const user = await userByEmail(req.user.email);
  await query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  res.status(200).end();
});

export default router;
