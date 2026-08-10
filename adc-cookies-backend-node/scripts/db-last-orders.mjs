import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`
  select o.id, o.order_number, o.total_amount, o.payment_status, o.order_status,
         o.carrier, o.shipment_status, o.delhivery_waybill, o.store_code, o.shipment_error,
         a.city, a.pincode, o.created_at
  from orders o left join addresses a on a.id = o.address_id
  order by o.id desc limit 5`);
for (const r of rows) {
  console.log(`#${r.id} ${r.order_number}  Rs${r.total_amount}  ${r.payment_status}/${r.order_status}`);
  console.log(`   deliver to : ${r.city} ${r.pincode}`);
  console.log(`   store_code : ${r.store_code ?? '(none)'}`);
  console.log(`   carrier    : ${r.carrier ?? '(none)'}   shipment: ${r.shipment_status ?? '-'}   awb: ${r.delhivery_waybill ?? '-'}`);
  if (r.shipment_error) console.log(`   error      : ${r.shipment_error}`);
  console.log('');
}
await c.end();
