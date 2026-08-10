// Verifies the JS-side shape of migrated columns via the app's own db.js (parsers included).
import { getOne, getAll } from '../src/db.js';
const bad = [];
const check = (label, val, want) => {
  const got = val === null ? 'null' : (val instanceof Date ? 'Date' : typeof val);
  const ok = got === want || got === 'null';
  if (!ok) bad.push(`${label}: expected ${want}, got ${got} (${JSON.stringify(val)?.slice(0,40)})`);
  console.log(`  ${ok ? 'ok ' : 'FAIL'} ${label.padEnd(30)} ${got.padEnd(7)} ${JSON.stringify(val)?.slice(0, 34)}`);
};
const o = await getOne('select * from orders order by id limit 1');
if (o) {
  console.log('orders:');
  for (const f of ['subtotal','discount_amount','delivery_fee','tax_amount','total_amount']) check('orders.'+f, o[f], 'number');
  check('orders.created_at', o.created_at, 'string');
}
const it = await getOne('select * from order_items limit 1');
if (it) { console.log('order_items:'); check('order_items.unit_price', it.unit_price, 'number'); check('order_items.total_price', it.total_price, 'number'); }
const p = await getOne('select * from products limit 1');
console.log('products:'); check('products.price', p.price, 'number'); check('products.updated_at', p.updated_at, 'string');
const c = await getOne('select * from coupons where expiry_date is not null limit 1');
if (c) { console.log('coupons:'); check('coupons.expiry_date', c.expiry_date, 'string'); check('coupons.discount_value', c.discount_value, 'number');
  console.log('  expiry_date compares as string:', c.expiry_date < new Date().toISOString().slice(0,10) ? 'EXPIRED' : 'active'); }
console.log('\narithmetic sanity (the string-concat trap):');
if (o) { const sum = o.subtotal + o.delivery_fee; console.log('  subtotal + delivery_fee =', sum, typeof sum === 'number' ? '(number, correct)' : '(STRING — BROKEN)');
  if (typeof sum !== 'number') bad.push('addition produced a string'); }
const agg = await getOne('select sum(total_amount) s from orders');
console.log('  SQL sum(total_amount) =', agg.s, typeof agg.s);
console.log(bad.length ? '\nFAILURES:\n' + bad.join('\n') : '\nALL TYPE CHECKS PASSED');
process.exit(bad.length ? 1 : 0);
