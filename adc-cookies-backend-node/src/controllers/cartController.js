import * as cartService from '../services/cartService.js';

export async function getCart(req, res) {
  res.json(await cartService.getCart(req.user.email));
}

export async function addItem(req, res) {
  const { productId, quantity, selectedOptions } = req.body || {};
  res.json(await cartService.addItem(req.user.email, productId, quantity, selectedOptions));
}

export async function updateItem(req, res) {
  const quantity = Number(req.body?.quantity ?? req.query.quantity);
  res.json(await cartService.updateItem(req.user.email, req.params.itemId, quantity));
}

export async function removeItem(req, res) {
  res.json(await cartService.removeItem(req.user.email, req.params.itemId));
}

export async function clearCart(req, res) {
  await cartService.clearCart(req.user.email);
  res.status(200).end();
}
