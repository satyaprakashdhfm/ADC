import { Router } from 'express';
import { getOne, getAll, query } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeAddress } from '../serializers.js';
import { normalizePhone } from '../messageCentral.js';

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

// A delivery address with no (or an unusable) phone number can never actually ship — Delhivery
// and Shadowfax both require one to create a shipment, and until now nothing stopped a customer
// from saving an address without one (an order placed against one just sat at NOT_CREATED
// forever, with no visible error). Required on every create/update; stored as a clean 10-digit
// national number regardless of how it was typed (with/without +91, spaces, etc).
function validateAddressInput(b) {
  const fullName = String(b.fullName || '').trim();
  if (!fullName) throw new ApiError('Full name is required.');
  const phone = normalizePhone(b.phone);
  if (!phone) throw new ApiError('Enter a valid 10-digit mobile number — it’s needed to create the delivery shipment.');
  const addressLine1 = String(b.addressLine1 || '').trim();
  if (!addressLine1) throw new ApiError('Address line 1 is required.');
  const city = String(b.city || '').trim();
  if (!city) throw new ApiError('City is required.');
  const pincode = String(b.pincode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pincode)) throw new ApiError('Enter a valid 6-digit pincode.');
  return { fullName, phone: phone.national, addressLine1, pincode };
}

router.get('/', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const rows = await getAll('SELECT * FROM addresses WHERE user_id = $1 ORDER BY id', [user.id]);
  res.json(rows.map(serializeAddress));
});

router.post('/', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const b = req.body || {};
  const v = validateAddressInput(b);

  if (b.isDefault) {
    await query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [user.id]);
  }

  const row = await getOne(
    `INSERT INTO addresses
       (user_id, full_name, phone, address_line1, address_line2, city, state, pincode, latitude, longitude, is_default, label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [user.id, v.fullName, v.phone, v.addressLine1, b.addressLine2 ?? null,
     canonicalCity(b.city), titleCase(b.state), v.pincode, b.latitude ?? null, b.longitude ?? null, !!b.isDefault, b.label || 'Home']
  );
  logAddress('create', row);
  res.json(serializeAddress(row));
});


/* One line per write, because this is the table where a wrong value is a rider at a stranger's
   door. Coordinates are logged explicitly: an address saved without them cannot be quoted for
   same-day at all, and one saved with the WRONG ones fails silently and looks correct on screen —
   the failure that cost us a week. "no-coords" in this log is the thing to grep for. */
function logAddress(verb, row) {
  const at = row.latitude != null && row.longitude != null ? `${row.latitude},${row.longitude}` : 'no-coords';
  console.log(`[ADDRESS] ${verb} | id=${row.id} | ${row.pincode} ${row.city || ''} | pin=${at}${row.is_default ? ' | default' : ''}`);
}

router.put('/:id', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const existing = await getOne('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!existing) throw new ApiError('Address not found', 404);
  const b = req.body || {};
  const v = validateAddressInput(b);

  if (b.isDefault) {
    await query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [user.id]);
  }

  /*
   * Coordinates are part of the address, and this route used to drop them on the floor.
   *
   * Only POST wrote latitude/longitude, so editing an address could never fix its location: the
   * form resolved a point, sent it, and the update quietly ignored it. An address saved without a
   * usable point — or with a wrong one — therefore kept telling the customer to "edit and re-save
   * to confirm same-day pricing", and editing and re-saving changed nothing at all. Forever.
   *
   * Written exactly as sent, nulls included. When the resolver cannot place an address it returns
   * no point on purpose, and clearing the stored one is the correct outcome: no coordinates means
   * no same-day offer, where stale wrong ones mean a rider at the wrong door.
   */
  const row = await getOne(
    `UPDATE addresses SET
       full_name=$1, phone=$2, address_line1=$3, address_line2=$4,
       city=$5, state=$6, pincode=$7, is_default=$8, label=$9,
       latitude=$10, longitude=$11
     WHERE id=$12 AND user_id=$13 RETURNING *`,
    [v.fullName, v.phone, v.addressLine1, b.addressLine2 ?? null,
     canonicalCity(b.city), titleCase(b.state), v.pincode, !!b.isDefault, b.label || 'Home',
     b.latitude ?? null, b.longitude ?? null,
     req.params.id, user.id]
  );
  logAddress('update', row);
  res.json(serializeAddress(row));
});

router.delete('/:id', async (req, res) => {
  const user = await userByEmail(req.user.email);
  await query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  res.status(200).end();
});

export default router;
