import { Router } from 'express';
import { getOne, getAll, query, nowIso } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeCart, serializeCartItem } from '../serializers.js';

const router = Router();
router.use(requireAuth);

async function userByEmail(email) {
  const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) throw new ApiError('User not found');
  return user;
}

export async function getCartRow(email) {
  const user = await userByEmail(email);
  let cart = await getOne('SELECT * FROM cart WHERE user_id = $1', [user.id]);
  if (!cart) {
    const ts = nowIso();
    cart = await getOne(
      'INSERT INTO cart (user_id, created_at, updated_at) VALUES ($1, $2, $3) RETURNING *',
      [user.id, ts, ts]
    );
  }
  return cart;
}

async function touchCart(cartId) {
  await query('UPDATE cart SET updated_at = $1 WHERE id = $2', [nowIso(), cartId]);
}

async function fullCart(cart) {
  const items = await getAll('SELECT * FROM cart_items WHERE cart_id = $1 ORDER BY id', [cart.id]);
  const serialized = await Promise.all(items.map(async (ci) => {
    const product = await getOne('SELECT * FROM products WHERE id = $1', [ci.product_id]);
    return serializeCartItem(ci, product);
  }));
  return serializeCart(cart, serialized);
}

router.get('/', async (req, res) => {
  const cart = await getCartRow(req.user.email);
  res.json(await fullCart(cart));
});

router.post('/items', async (req, res) => {
  const cart = await getCartRow(req.user.email);
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
  res.json(await fullCart(await getOne('SELECT * FROM cart WHERE id = $1', [cart.id])));
});

router.patch('/items/:itemId', async (req, res) => {
  const cart = await getCartRow(req.user.email);
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
  res.json(await fullCart(await getOne('SELECT * FROM cart WHERE id = $1', [cart.id])));
});

router.delete('/items/:itemId', async (req, res) => {
  const cart = await getCartRow(req.user.email);
  await query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2', [req.params.itemId, cart.id]);
  await touchCart(cart.id);
  res.json(await fullCart(await getOne('SELECT * FROM cart WHERE id = $1', [cart.id])));
});

router.delete('/', async (req, res) => {
  const cart = await getCartRow(req.user.email);
  await query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
  await touchCart(cart.id);
  res.status(200).end();
});

export default router;
