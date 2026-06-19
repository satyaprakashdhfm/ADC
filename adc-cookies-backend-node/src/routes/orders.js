import { Router } from 'express';
import { getOne, getAll, query, withTransaction, nowIso } from '../db.js';
import { requireAuth, ApiError } from '../middleware.js';
import { serializeOrder, serializeOrderItem, serializeTracking, serializeAddress } from '../serializers.js';
import { getCartRow } from './cart.js';
import { validateCoupon, calculateDiscount } from './coupons.js';
import { sendOrderEmails } from '../mailer.js';
import { fetchWaybill, createShipment, trackShipment, delhiveryConfigured } from '../delhivery.js';

const router = Router();
router.use(requireAuth);

// Auto-create a Delhivery shipment once an order is PAID.
// Never throws — returns { ok, reason?, waybill? } so the caller (payment verify) stays safe.
// Idempotent: if the order already has a waybill, it does nothing.
async function autoCreateShipment(orderId, addressArg) {
  if (!delhiveryConfigured()) { console.log(`[SHIPMENT] auto | order=${orderId} | skip=delhivery_not_configured`); return { ok: false, reason: 'not_configured' }; }

  const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) { console.log(`[SHIPMENT] auto | order=${orderId} | skip=order_not_found`); return { ok: false, reason: 'order_not_found' }; }
  if (order.delhivery_waybill) { console.log(`[SHIPMENT] auto | order=${order.order_number} | skip=already_created (waybill=${order.delhivery_waybill})`); return { ok: true, waybill: order.delhivery_waybill }; }

  const address = addressArg || (order.address_id ? await getOne('SELECT * FROM addresses WHERE id = $1', [order.address_id]) : null);
  if (!address) { console.log(`[SHIPMENT] auto | order=${order.order_number} | skip=no_address`); return { ok: false, reason: 'no_address' }; }

  const defaultWh = await getOne('SELECT * FROM warehouses WHERE is_active = TRUE ORDER BY is_default DESC, id ASC LIMIT 1');
  if (!defaultWh) { console.log(`[SHIPMENT] auto | order=${order.order_number} | skip=no_active_warehouse`); return { ok: false, reason: 'no_warehouse' }; }

  const waybillRes = await fetchWaybill(1);
  if (!waybillRes.ok || !waybillRes.waybills?.length) {
    console.log(`[SHIPMENT] auto | order=${order.order_number} | waybill_fetch=FAILED | reason=${waybillRes.reason}`);
    return { ok: false, reason: `waybill_fetch:${waybillRes.reason}` };
  }
  const waybill = String(waybillRes.waybills[0]);

  const items = await getAll('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
  const productsDesc = items.map(i => `${i.product_name} x${i.quantity}`).join(', ') || 'Cookies';
  const quantity = String(items.reduce((s, i) => s + i.quantity, 0) || 1);

  const shipmentData = {
    waybill,
    name: address.full_name || 'Customer',
    add: [address.address_line1, address.address_line2].filter(Boolean).join(', '),
    city: address.city,
    state: address.state || '',
    country: 'India',
    pin: address.pincode,
    phone: address.phone,
    order: order.order_number,
    payment_mode: 'Pre-paid',
    return_pin: defaultWh.return_pincode || defaultWh.pincode,
    return_city: defaultWh.city || '',
    return_phone: defaultWh.phone || '',
    return_name: defaultWh.name || '',
    return_add: [defaultWh.address_line1, defaultWh.address_line2].filter(Boolean).join(', ') || defaultWh.city || '',
    return_state: defaultWh.state || '',
    return_country: 'India',
    products_desc: productsDesc,
    hsn_code: '19053100',
    cod_amount: 0,
    order_date: order.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    total_amount: String(order.total_amount),
    seller_add: [defaultWh.address_line1, defaultWh.city].filter(Boolean).join(', '),
    seller_name: defaultWh.registered_name || defaultWh.name || '',
    seller_inv: order.order_number,
    quantity,
    shipment_width: 20,
    shipment_height: 10,
    weight: 0.5,
    seller_gst_tin: '',
    shipping_mode: 'Surface',
    address_type: 'home',
  };

  console.log(`[SHIPMENT] auto | order=${order.order_number} | waybill=${waybill} | wh=${defaultWh.pickup_location} | dest=${address.pincode} | creating…`);
  const result = await createShipment(shipmentData, defaultWh.pickup_location);
  if (!result.ok) {
    console.log(`[SHIPMENT] auto | order=${order.order_number} | create=FAILED | reason=${result.reason} | detail=${JSON.stringify(result.detail || '').slice(0, 200)}`);
    return { ok: false, reason: result.reason };
  }

  await query(
    `UPDATE orders SET delhivery_waybill=$1, shipment_status='CREATED', tracking_url=$2, label_generated=TRUE, updated_at=$3 WHERE id=$4`,
    [result.waybill, `https://www.delhivery.com/track/package/${result.waybill}`, nowIso(), orderId]
  );
  console.log(`[SHIPMENT] auto | order=${order.order_number} | waybill=${result.waybill} | ok=true | label=ready`);
  return { ok: true, waybill: result.waybill };
}

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

  // Scope the address to the caller so an order can never reference another user's address.
  const address = await getOne('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [addressId, user.id]);
  if (!address) throw new ApiError('Address not found');

  const subtotal = lineItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  let discount = 0, coupon = null;
  if (couponCode && String(couponCode).trim()) {
    coupon = await validateCoupon(couponCode, subtotal);
    discount = calculateDiscount(coupon, subtotal);
  }

  const deliveryFee = subtotal > 0 ? 100 : 0;   // flat ₹100 delivery (matches the storefront)
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

  // Confirmation email to the customer + a copy to the business (best-effort; never throws).
  await sendOrderEmails({
    orderNumber, subtotal, discount, deliveryFee, total,
    customerName: user.name, customerEmail: user.email,
    items: lineItems.map((li) => ({ name: li.productName, qty: li.quantity, total: li.unitPrice * li.quantity })),
    address,
  });

  // NOTE: the Delhivery shipment is created on payment success (see /:id/payment/verify),
  // not here — we only ship orders that are actually paid.
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
  const user = await userByEmail(req.user.email);
  // Scope to the owner so one user can never read another's order.
  const order = await getOne('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!order) throw new ApiError('Order not found');
  res.json(await fullOrder(order.id));
});

router.get('/:id/tracking', async (req, res) => {
  const user = await userByEmail(req.user.email);
  // Only expose tracking for an order the caller owns.
  const order = await getOne('SELECT id FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!order) throw new ApiError('Order not found');
  const rows = await getAll(
    'SELECT * FROM order_tracking WHERE order_id = $1 ORDER BY created_at ASC, id ASC', [order.id]
  );
  res.json(rows.map(serializeTracking));
});

router.get('/:id/delhivery-track', async (req, res) => {
  const user = await userByEmail(req.user.email);
  const order = await getOne('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!order) throw new ApiError('Order not found');
  if (!order.delhivery_waybill) return res.json({ tracked: false, reason: 'no_waybill' });
  const result = await trackShipment(order.delhivery_waybill);
  if (!result.ok) return res.json({ tracked: false, reason: result.reason });
  // Pull the latest status string from the Delhivery response for the status update
  const pkg = Array.isArray(result.data?.ShipmentData) ? result.data.ShipmentData[0]?.Shipment : null;
  const latestStatus = pkg?.Status?.Status || null;
  if (latestStatus) {
    await query('UPDATE orders SET shipment_status=$1, updated_at=$2 WHERE id=$3', [latestStatus, nowIso(), order.id]);
  }
  return res.json({ tracked: true, waybill: order.delhivery_waybill, data: result.data });
});

router.post('/:id/payment/verify', async (req, res) => {
  const user = await userByEmail(req.user.email);
  // Scope to the owner so one user can never mark another's order as paid.
  const order = await getOne('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
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

  // Now that the order is PAID, create the Delhivery shipment + label. Never throws,
  // so a Delhivery hiccup can't fail the payment confirmation — admin can retry from the panel.
  const ship = await autoCreateShipment(order.id);
  if (ship.ok && ship.waybill) {
    await query(
      'INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
      [order.id, 'SHIPMENT_CREATED', `Delhivery waybill ${ship.waybill}`, nowIso()]
    );
  }

  res.json(await fullOrder(order.id));
});

export default router;
