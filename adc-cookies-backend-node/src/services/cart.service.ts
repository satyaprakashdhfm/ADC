import { getOne, getAll, query, nowIso } from '../db/index.js';
import { serializeCart, serializeCartItem, withImageUrls } from '../serializers/index.js';
import { userByEmail } from './user.service.js';

/*
 * The cart, as rows rather than as HTTP.
 *
 * getCartRow is the reason this file exists: the order route needs the caller's cart to turn it
 * into an order, and was reaching into the cart ROUTE to get it. That made routes/orders.js
 * import routes/cart.js — one router importing another for its logic, which is what Phase B is
 * unpicking.
 */

/**
 * The caller's cart, created on first touch.
 *
 * Every cart operation starts here, including the ones that only read, so a customer who has never
 * added anything still gets a real row to attach items to instead of a null the caller must handle.
 */
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

export async function touchCart(cartId) {
  await query('UPDATE cart SET updated_at = $1 WHERE id = $2', [nowIso(), cartId]);
}

/** Re-read a cart by id — what the write endpoints return once they have changed something. */
export const cartById = (id) => getOne('SELECT * FROM cart WHERE id = $1', [id]);

/** A cart with its items and their products, serialized for the API. */
export async function fullCart(cart) {
  const items = await getAll('SELECT * FROM cart_items WHERE cart_id = $1 ORDER BY id', [cart.id]);
  const serialized = await Promise.all(items.map(async (ci) => {
    const product = await getOne('SELECT * FROM products WHERE id = $1', [ci.product_id]);
    return serializeCartItem(ci, product);
  }));
  // The cart shows product photos too, so its items need signing exactly like a catalogue row.
  return serializeCart(cart, await withImageUrls(serialized));
}
