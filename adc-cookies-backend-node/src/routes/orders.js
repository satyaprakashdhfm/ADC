import { Router } from 'express';
import { getOne, getAll, query, withTransaction, nowIso } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeOrder, serializeOrderItem, serializeTracking, serializeAddress } from '../serializers.js';
import { getCartRow } from './cart.js';
import { validateCoupon, calculateDiscount } from './coupons.js';

const router = Router();
router.use(requireAuth);

async function userByEmail(email) {
  const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) throw new ApiError('User not found');
  return user;
}

function pad(n) { return String(n).padStart(2, '0'); }
async function genOrderNumber() {
  const d = new Date();
  const base = 'ADC' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
    + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  let candidate = base, n = 0;
  while (await getOne('SELECT 1 FROM orders WHERE order_number = $1', [candidate])) {
    candidate = base + (++n);
  }
  return candidate;
}

async function fullOrder(orderId) {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]);
  const address = order.address_id
    ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id])
    : null;
  return serializeOrder(order, items, address);
}

router.post('/', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const { addressId, couponCode, items: bodyItems } = req.body || {};

  let lineItems;
  if (Array.isArray(bodyItems) && bodyItems.length > 0) {
    lineItems = await Promise.all(bodyItems.map(async (it) => {
      const product = await getOne('SELECT * FROM products WHERE id = $1', [it.productId]);
      if (!product) throw new ApiError(`Product not found: ${it.productId}`);
      return { product, productName: product.name, quantity: it.quantity || 1, unitPrice: product.price,
               selectedOptions: it.selectedOptions ? JSON.stringify(it.selectedOptions) : null,
               specialNotes: it.specialNotes ?? null };
    }));
  } else {
    const cart = await getCartRow(req.user.email);
    const cartItems = await getAll('SELECT * FROM cart_items WHERE cart_id = $1', [cart.id]);
    if (cartItems.length === 0) throw new ApiError('Cart is empty');
    lineItems = await Promise.all(cartItems.map(async (ci) => {
      const product = await getOne('SELECT * FROM products WHERE id = $1', [ci.product_id]);
      return { product, productName: product ? product.name : 'Item', quantity: ci.quantity,
               unitPrice: ci.unit_price, selectedOptions: ci.selected_options, specialNotes: null };
    }));
  }

  const address = await getOne('SELECT * FROM addresses WHERE id = $1', [addressId]);
  if (!address) throw new ApiError('Address not found');

  const subtotal = lineItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  let discount = 0, coupon = null;
  if (couponCode && String(couponCode).trim()) {
    coupon = await validateCoupon(couponCode, subtotal);
    discount = calculateDiscount(coupon, subtotal);
  }

  const deliveryFee = subtotal >= 500 ? 0 : 49;
  const total = subtotal - discount + deliveryFee;
  const ts = nowIso();
  const orderNumber = await genOrderNumber();

  const orderId = await withTransaction(async (client) => {
    const { rows: [order] } = await client.query(
      `INSERT INTO orders
         (order_number, user_id, address_id, subtotal, discount_amount, delivery_fee, tax_amount,
          total_amount, coupon_code, payment_status, order_status, shipment_status, label_generated,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING','PLACED','NOT_CREATED',FALSE,$10,$11) RETURNING id`,
      [orderNumber, user.id, address.id, subtotal, discount, deliveryFee, 0, total,
       couponCode ?? null, ts, ts]
    );
    const oid = order.id;
    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items
           (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [oid, li.product?.id ?? null, li.productName, li.quantity,
         li.unitPrice, li.unitPrice * li.quantity, li.selectedOptions, li.specialNotes]
      );
    }
    await client.query(
      'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [oid, 'PLACED', 'Order placed successfully', ts]
    );
    if (coupon) {
      await client.query(
        'INSERT INTO coupon_usage (coupon_id, user_id, order_id, used_at) VALUES ($1,$2,$3,$4)',
        [coupon.id, user.id, oid, ts]
      );
    }
    return oid;
  });

  const cart = await getOne('SELECT * FROM cart WHERE user_id = $1', [user.id]);
  if (cart) await query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);

  res.json(await fullOrder(orderId));
});

router.get('/', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const rows = await getAll(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC, id DESC', [user.id]
  );
  const serialized = await Promise.all(rows.map(async (o) => {
    const items = await getAll('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [o.id]);
    const address = o.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [o.address_id]) : null;
    return serializeOrder(o, items, address);
  }));
  res.json(serialized);
});

router.get('/:id', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  res.json(await fullOrder(order.id));
});

router.get('/:id/tracking', async (req, res) => {
  const rows = await getAll(
    'SELECT * FROM order_tracking WHERE order_id = $1 ORDER BY created_at ASC, id ASC', [req.params.id]
  );
  res.json(rows.map(serializeTracking));
});

router.post('/:id/payment/verify', async (req, res) => {
  const order = await getOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) throw new ApiError('Order not found');
  const { razorpayPaymentId } = req.body || {};
  const ts = nowIso();
  await query(`UPDATE orders SET payment_status='PAID', order_status='CONFIRMED', updated_at=$1 WHERE id=$2`, [ts, order.id]);
  await query(
    `INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at)
     VALUES ($1,'RAZORPAY',$2,$3,'PAID',$4,$5)`,
    [order.id, razorpayPaymentId ?? null, order.total_amount, ts, ts]
  );
  await query(
    'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
    [order.id, 'CONFIRMED', 'Payment received via Razorpay', ts]
  );
  res.json(await fullOrder(order.id));
});

export default router;
