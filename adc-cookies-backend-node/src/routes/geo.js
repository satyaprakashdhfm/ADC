import { Router } from 'express';
import { geoSuggest, geoReverse, geoForward, geoProvider } from '../geo.js';

/*
 * The browser's only route to a geocoder.
 *
 * Nothing on the storefront talks to a geocoding provider directly any more. That was never a
 * layering nicety: the public Nominatim instance forbids autocomplete traffic and blocks by IP, and
 * a browser cannot send the User-Agent it asks every caller to identify itself with. Meanwhile the
 * Mappls key is domain-locked, so shipping it to a client makes it usable by anyone who reads the
 * page source on that domain.
 *
 * Behind this router the provider can change without a single frontend edit — which is the whole
 * point, given Mappls' REST products are not enabled on our account yet.
 *
 * Public, like the storefront it serves: someone has to be able to type an address before they have
 * an account. Deliberately read-only and parameter-shaped, so the worst it can be abused for is
 * making our server ask a map a question.
 */
const router = Router();

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

router.get('/suggest', async (req, res) => {
  const near = num(req.query.lat) != null && num(req.query.lng) != null
    ? { lat: num(req.query.lat), lng: num(req.query.lng) } : null;
  res.json({ provider: geoProvider(), results: await geoSuggest(req.query.q, near) });
});

router.get('/reverse', async (req, res) => {
  const lat = num(req.query.lat), lng = num(req.query.lng);
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  res.json({ provider: geoProvider(), place: await geoReverse(lat, lng) });
});

router.get('/forward', async (req, res) => {
  const address = String(req.query.address || '').trim();
  const pincode = String(req.query.pincode || '').replace(/\D/g, '');
  if (!address && !pincode) return res.status(400).json({ error: 'address or pincode is required' });
  res.json({ provider: geoProvider(), point: await geoForward(address, pincode) });
});

export default router;
