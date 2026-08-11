import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const snaps = (await c.query(`select id, rest_id, source, item_count, received_at from petpooja_menu_snapshots order by id desc limit 6`)).rows;
console.log('--- menu pushes received ---');
for (const s of snaps) console.log(`  #${s.id}  ${s.received_at}  source=${s.source}  items=${s.item_count}  rest=${s.rest_id}`);

const items = (await c.query(`select name, variation_name, price, product_id from petpooja_items order by name`)).rows;
console.log(`\n--- items currently stored: ${items.length} ---`);
const tins = items.filter(i => /tin|gift|box|pack/i.test(i.name));
console.log(`items matching tin/gift/box/pack: ${tins.length}`);
for (const t of tins) console.log(`  ${t.name}${t.variation_name ? ' — ' + t.variation_name : ''}  Rs${t.price}  ${t.product_id ? '(linked)' : '(unlinked)'}`);
console.log('\n--- all item names ---');
console.log(items.map(i => i.name + (i.variation_name ? `/${i.variation_name}` : '')).join(' | '));
await c.end();
