/*
 * req.user is asserted non-null throughout this file: every route in it sits behind
 * router.use(requireAuth), which 401s before a handler runs. TypeScript cannot see through
 * middleware, so it has to be told. Adding a route here WITHOUT that gate would make these
 * assertions false — the gate is what makes them true.
 */
import { Router } from 'express';
import { getOne, query } from '../db/index.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import { getCartRow, touchCart, cartById, fullCart } from '../services/cart.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const cart = await getCartRow(req.user!.email);
  res.json(await fullCart(cart));
});

router.post('/items', async (req, res) => {
  const cart = await getCartRow(req.user!.email);
  const { productId, quantity, selectedOptions } = req.body || {};
  const product = await getOne('SELECT * FROM products WHERE id = $1', [productId]);
  if (!product) throw new ApiError('Product not found');

  const existing = await getOne('SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cart.id, productId]);
  if (existing) {
    await query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [existing.quantity + (quantity || 1), existing.id]);
  } else {
    await query(
      'INSERT INTO cart_items (cart_id, product_id, quantity, selected_options, unit_price) VALUES ($1,$2,$3,$4,$5)',
      [cart.id, productId, quantity || 1,
       selectedOptions ? JSON.stringify(selectedOptions) : null, product.price]
    );
  }
  await touchCart(cart.id);
  res.json(await fullCart(await cartById(cart.id)));
});

router.patch('/items/:itemId', async (req, res) => {
  const cart = await getCartRow(req.user!.email);
  const quantity = Number(req.body?.quantity ?? req.query.quantity);
  const item = await getOne('SELECT * FROM cart_items WHERE id = $1 AND cart_id = $2', [req.params.itemId, cart.id]);
  if (item) {
    if (quantity <= 0) {
      await query('DELETE FROM cart_items WHERE id = $1', [item.id]);
    } else {
      await query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [quantity, item.id]);
    }
    await touchCart(cart.id);
  }
  res.json(await fullCart(await cartById(cart.id)));
});

router.delete('/items/:itemId', async (req, res) => {
  const cart = await getCartRow(req.user!.email);
  await query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2', [req.params.itemId, cart.id]);
  await touchCart(cart.id);
  res.json(await fullCart(await cartById(cart.id)));
});

router.delete('/', async (req, res) => {
  const cart = await getCartRow(req.user!.email);
  await query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
  await touchCart(cart.id);
  res.status(200).end();
});

export default router;
