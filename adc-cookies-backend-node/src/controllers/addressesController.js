import * as addressesService from '../services/addressesService.js';

export async function getAddresses(req, res) {
  res.json(await addressesService.getAddresses(req.user.email));
}

export async function addAddress(req, res) {
  res.json(await addressesService.addAddress(req.user.email, req.body || {}));
}

export async function deleteAddress(req, res) {
  await addressesService.deleteAddress(req.params.id);
  res.status(200).end();
}
