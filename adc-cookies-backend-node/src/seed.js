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

  const ins = async (o) => {
    const { rows: [r] } = await q(
      `INSERT INTO products (name, category, description, price, stock_quantity, images, options,
                             is_available, menu_group, tag, featured, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10,$11,$12) RETURNING id`,
      [o.name, o.category, o.description, o.price, o.stock, o.images, o.options,
       o.menuGroup, o.tag, !!o.featured, ts, ts]
    );
    return r.id;
  };

  const img = (file) => JSON.stringify([`/assets/products/${file}`]);

  // --- Cookies (the real ADC menu) ---
  const p1 = await ins({ name: 'Chocolate Chip', category: 'COOKIES', price: 60, stock: 150,
    description: 'The original. Buttery dough, browned-butter base and premium dark chocolate chips — crisp at the edges, gooey at the core.',
    images: img('blueberry.jpg'), options: '["Extra Chocolate","Less Sweet","Gift Wrap","Message Card"]',
    menuGroup: 'Classic Cookies', tag: 'Classic', featured: false });

  const p2 = await ins({ name: 'Double Choc Chip', category: 'COOKIES', price: 65, stock: 130,
    description: 'Rich cocoa dough loaded with extra-dark chocolate chunks and a dusting of Dutch cocoa. Fudgy and impossible to resist.',
    images: img('triple-choc.jpg'), options: '["Extra Chocolate","Gift Wrap","Message Card"]',
    menuGroup: 'Classic Cookies', tag: 'Bestseller', featured: true });

  await ins({ name: 'Raagi (Gluten Free)', category: 'COOKIES', price: 60, stock: 90,
    description: 'Wholesome finger-millet cookie, naturally gluten free, with a warm nutty depth and just the right chew.',
    images: img('oatmeal-raisin.jpg'), options: '["Less Sweet","Gift Wrap","Message Card"]',
    menuGroup: 'Classic Cookies', tag: 'Gluten Free', featured: false });

  await ins({ name: 'Matcha', category: 'COOKIES', price: 90, stock: 70,
    description: 'Stone-ground ceremonial matcha from Uji, Japan folded into buttery dough with cacao-butter white-chocolate chips.',
    images: img('matcha.jpg'), options: '["Extra White Chocolate","Less Sugar","Gift Wrap","Message Card"]',
    menuGroup: 'Premium Cookies', tag: 'Premium', featured: true });

  await ins({ name: 'ADC Special', category: 'COOKIES', price: 90, stock: 120,
    description: 'Our crown jewel — slow-browned butter, three kinds of premium chocolate and hand-harvested Maldon sea-salt flakes.',
    images: img('adc-special.jpg'), options: '["Extra Chocolate","Sea Salt","Gift Wrap","Message Card"]',
    menuGroup: 'Premium Cookies', tag: 'Signature', featured: true });

  await ins({ name: 'Red Velvet With Cheese', category: 'COOKIES', price: 90, stock: 80,
    description: 'Deep cocoa-red velvet dough wrapped around a tangy cream-cheese centre that softens as it bakes. Our most dramatic cookie.',
    images: img('red-velvet.jpg'), options: '["Extra Cream Cheese","Gift Wrap","Message Card"]',
    menuGroup: 'Premium Cookies', tag: 'Premium', featured: true });

  const biscoff = await ins({ name: 'Biscoff Filled', category: 'COOKIES', price: 110, stock: 100,
    description: 'Caramelised cookie shell around a warm, molten river of Belgian Lotus Biscoff spread. Frozen before baking for a lava-like centre.',
    images: img('peanut-butter.jpg'), options: '["Extra Biscoff","Gift Wrap","Message Card"]',
    menuGroup: 'Filled Cookies', tag: 'Bestseller', featured: true });

  const nutella = await ins({ name: 'Nutella Filled', category: 'COOKIES', price: 90, stock: 110,
    description: 'A gooey Nutella centre tucked inside a soft chocolate cookie. Absolutely irresistible warm.',
    images: img('caramel-cashew.jpg'), options: '["Extra Nutella","Gift Wrap","Message Card"]',
    menuGroup: 'Filled Cookies', tag: 'Recommended', featured: false });

  // --- Gift Tins ---
  await ins({ name: 'Nutella Tin', category: 'TINS', price: 600, stock: 30,
    description: 'Six premium Nutella-filled cookies in a keepsake gift tin. Perfect for gifting and celebrations.',
    images: img('coffee-almond.jpg'), options: '["Custom Message","Ribbon Wrap","Premium Box"]',
    menuGroup: 'Gift Tins', tag: 'Gift', featured: false });

  const t2 = await ins({ name: 'Biscoff Tin', category: 'TINS', price: 850, stock: 20,
    description: 'Nine Biscoff-filled cookies, gift-ready in a premium tin with a ribbon wrap and name tag.',
    images: img('m-and-m.jpg'), options: '["Custom Message","Ribbon Wrap","Premium Box","Free Name Tag"]',
    menuGroup: 'Gift Tins', tag: 'Gift', featured: false });
  console.log('Products created: 8 cookies + 2 tins (real ADC menu)');

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
    ['ADC20260610001', priya.id, addr1.id, 185, 18.50, 49, 0, 215.50,
     'WELCOME10', 'PAID', 'DELIVERED', 'DLV123456789', 'https://www.delhivery.com/track/package/DLV123456789', 'DELIVERED', true, ts, ts]
  );
  await q(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [o1.id, p1, 'Chocolate Chip', 2, 60, 120, '["Extra Chocolate"]', null]);
  await q(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [o1.id, p2, 'Double Choc Chip', 1, 65, 65, '[]', null]);
  await q(`INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [o1.id, 'RAZORPAY', 'pay_ADC001ABCDEF', 215.50, 'PAID', ts, ts]);
  for (const [status, remarks] of [
    ['PLACED','Order placed'],['CONFIRMED','Payment received'],['PREPARING','Baking in progress'],
    ['PACKED','Packed and ready for pickup'],['OUT_FOR_DELIVERY','Out for delivery with Delhivery'],['DELIVERED','Delivered successfully'],
  ]) await q('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)', [o1.id, status, remarks, ts]);

  // Sample Order 2 — Rahul, in progress
  const { rows: [o2] } = await q(
    `INSERT INTO orders (order_number, user_id, address_id, subtotal, discount_amount, delivery_fee, tax_amount, total_amount,
       coupon_code, payment_status, order_status, shipment_status, label_generated, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    ['ADC20260610002', rahul.id, addr2.id, 850, 0, 0, 0, 850, null, 'PAID', 'PREPARING', 'NOT_CREATED', false, ts, ts]
  );
  await q(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [o2.id, t2, 'Biscoff Tin', 1, 850, 850, '["Custom Message","Ribbon Wrap"]', "Please write 'Happy Birthday Meera' on the card"]);
  await q(`INSERT INTO payments (order_id, provider, transaction_id, amount, status, paid_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [o2.id, 'RAZORPAY', 'pay_ADC002XYZABC', 850, 'PAID', ts, ts]);
  for (const [status, remarks] of [
    ['PLACED','Order placed'],['CONFIRMED','Payment confirmed'],['PREPARING','Baking your cookies'],
  ]) await q('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)', [o2.id, status, remarks, ts]);

  console.log('Sample orders created');
  console.log('=== Dummy data loaded successfully! ===');
  console.log('Admin: admin@adccookies.com / admin123');
  console.log('Customer 1: priya@example.com / priya123');
  console.log('Customer 2: rahul@example.com / rahul123');
}
