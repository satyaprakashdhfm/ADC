import bcrypt from 'bcryptjs';
import { pool, nowIso } from './db.js';

export async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*) AS c FROM users');
  if (Number(rows[0].c) > 0) {
    console.log('Data already loaded — skipping seed.');
    return;
  }
  console.log('Seeding dummy data...');

  const ts = nowIso();
  const hash = (pw) => bcrypt.hash(pw, 10);

  const dateOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const q = (sql, p = []) => pool.query(sql, p);

  const { rows: [admin] } = await q(
    `INSERT INTO users (name, email, phone, password, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    ['ADC Admin', 'admin@adccookies.com', '9000000001', await hash('admin123'), 'ADMIN', ts, ts]
  );
  const { rows: [priya] } = await q(
    `INSERT INTO users (name, email, phone, password, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    ['Priya Sharma', 'priya@example.com', '9876543210', await hash('priya123'), 'CUSTOMER', ts, ts]
  );
  const { rows: [rahul] } = await q(
    `INSERT INTO users (name, email, phone, password, role, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    ['Rahul Verma', 'rahul@example.com', '9123456789', await hash('rahul123'), 'CUSTOMER', ts, ts]
  );
  console.log('Users created: admin, priya, rahul');

  const { rows: [addr1] } = await q(
    `INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, pincode, latitude, longitude, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [priya.id, 'Priya Sharma', '9876543210', '42, MG Road', 'Near Metro Station', 'Bangalore', 'Karnataka', '560001', 12.9716, 77.5946, true]
  );
  const { rows: [addr2] } = await q(
    `INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, pincode, latitude, longitude, is_default)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [rahul.id, 'Rahul Verma', '9123456789', '17, Connaught Place', null, 'New Delhi', 'Delhi', '110001', 28.6315, 77.2167, true]
  );
  console.log('Addresses created');

  const ins = async (name, category, description, price, stock, images, options) => {
    const { rows: [r] } = await q(
      `INSERT INTO products (name, category, description, price, stock_quantity, images, options, is_available, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9) RETURNING id`,
      [name, category, description, price, stock, images, options, ts, ts]
    );
    return r.id;
  };

  const p1 = await ins('Classic Chocolate Chip Cookie', 'COOKIES', 'Our signature cookie loaded with premium Belgian chocolate chips. Crispy on the outside, gooey on the inside.', 120, 150, '["https://images.unsplash.com/photo-1499636136210-6f4ee915583e"]', '["Extra Chocolate","Less Sweet","Gift Wrap","Message Card"]');
  const p2 = await ins('Biscoff Lava Cookie', 'COOKIES', 'Warm cookie filled with molten Biscoff spread. A European delight in every bite.', 149, 80, '["https://images.unsplash.com/photo-1558961363-fa8fdf82db35"]', '["Extra Biscoff","Gift Wrap","Message Card"]');
  await ins('Nutella Stuffed Cookie', 'COOKIES', 'Double chocolate cookie with a generous Nutella filling. Absolutely irresistible.', 139, 100, '["https://images.unsplash.com/photo-1548365328-8c6db3220e4c"]', '["Extra Nutella","Gift Wrap","Message Card"]');
  await ins('Peanut Butter Crunch Cookie', 'COOKIES', 'Rich peanut butter cookie with crunchy peanut pieces. A perfect snack for PB lovers.', 110, 120, '["https://images.unsplash.com/photo-1590080876351-41f8c04b6af5"]', '["Extra Crunchy","Gift Wrap","Message Card"]');
  await ins('Red Velvet Cookie', 'COOKIES', 'Stunning red velvet cookie with cream cheese drizzle. Perfect for gifting.', 159, 60, '["https://images.unsplash.com/photo-1612203985729-70726954388c"]', '["Extra Cream Cheese","Gift Wrap","Message Card"]');
  await ins('Matcha White Chocolate Cookie', 'COOKIES', 'Premium Japanese matcha cookie studded with white chocolate chips.', 169, 45, '["https://images.unsplash.com/photo-1558303836-50ad5f87e08e"]', '["Extra White Chocolate","Less Sugar","Gift Wrap","Message Card"]');
  await ins('Classic Cookie Tin (12 pcs)', 'TINS', 'A beautiful gift tin with 12 assorted cookies. Perfect for festivals and celebrations.', 899, 30, '["https://images.unsplash.com/photo-1481931098730-318b6f776db0"]', '["Custom Message","Ribbon Wrap","Premium Box"]');
  const t2 = await ins('Premium Cookie Tin (24 pcs)', 'TINS', 'Our largest gift tin with 24 cookies in assorted flavours. The ultimate cookie gift.', 1599, 15, '["https://images.unsplash.com/photo-1607920591413-4ec007e70023"]', '["Custom Message","Ribbon Wrap","Premium Box","Free Name Tag"]');
  console.log('Products created: 6 cookies + 2 tins');

  await q(`INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, expiry_date, usage_limit, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    ['WELCOME10', 'PERCENTAGE', 10, 300, 100, dateOffset(90), 500, true]);
  await q(`INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, expiry_date, usage_limit, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    ['FLAT50', 'FLAT', 50, 500, null, dateOffset(30), 200, true]);
  await q(`INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, expiry_date, usage_limit, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    ['SWEETDEAL20', 'PERCENTAGE', 20, 700, 200, dateOffset(60), 100, true]);
  await q(`INSERT INTO coupons (code, discount_type, discount_value, minimum_order_amount, maximum_discount, expiry_date, usage_limit, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    ['DIWALI25', 'PERCENTAGE', 25, 1000, 300, dateOffset(-10), 50, false]);
  console.log('Coupons created');

  // Sample Order 1 — Priya, delivered
  const { rows: [o1] } = await q(
    `INSERT INTO orders (order_number, user_id, address_id, subtotal, discount_amount, delivery_fee, tax_amount, total_amount,
       coupon_code, payment_status, order_status, delhivery_waybill, tracking_url, shipment_status, label_generated, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
    ['ADC20260610001', priya.id, addr1.id, 388, 38.80, 0, 0, 349.20,
     'WELCOME10', 'PAID', 'DELIVERED', 'DLV123456789', 'https://www.delhivery.com/track/package/DLV123456789', 'DELIVERED', true, ts, ts]
  );
  await q(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [o1.id, p1, 'Classic Chocolate Chip Cookie', 2, 120, 240, '["Extra Chocolate"]', null]);
  await q(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [o1.id, p2, 'Biscoff Lava Cookie', 1, 149, 149, '[]', null]);
  await q(`INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [o1.id, 'RAZORPAY', 'pay_ADC001ABCDEF', 349.20, 'PAID', ts, ts]);
  for (const [status, remarks] of [
    ['PLACED','Order placed'],['CONFIRMED','Payment received'],['PREPARING','Baking in progress'],
    ['PACKED','Packed and ready for pickup'],['OUT_FOR_DELIVERY','Out for delivery with Delhivery'],['DELIVERED','Delivered successfully'],
  ]) await q('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)', [o1.id, status, remarks, ts]);

  // Sample Order 2 — Rahul, in progress
  const { rows: [o2] } = await q(
    `INSERT INTO orders (order_number, user_id, address_id, subtotal, discount_amount, delivery_fee, tax_amount, total_amount,
       coupon_code, payment_status, order_status, shipment_status, label_generated, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    ['ADC20260610002', rahul.id, addr2.id, 1599, 0, 0, 0, 1599, null, 'PAID', 'PREPARING', 'NOT_CREATED', false, ts, ts]
  );
  await q(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [o2.id, t2, 'Premium Cookie Tin (24 pcs)', 1, 1599, 1599, '["Custom Message","Ribbon Wrap"]', "Please write 'Happy Birthday Meera' on the card"]);
  await q(`INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [o2.id, 'RAZORPAY', 'pay_ADC002XYZABC', 1599, 'PAID', ts, ts]);
  for (const [status, remarks] of [
    ['PLACED','Order placed'],['CONFIRMED','Payment confirmed'],['PREPARING','Baking your cookies'],
  ]) await q('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)', [o2.id, status, remarks, ts]);

  console.log('Sample orders created');
  console.log('=== Dummy data loaded successfully! ===');
  console.log('Admin: admin@adccookies.com / admin123');
  console.log('Customer 1: priya@example.com / priya123');
  console.log('Customer 2: rahul@example.com / rahul123');
}
