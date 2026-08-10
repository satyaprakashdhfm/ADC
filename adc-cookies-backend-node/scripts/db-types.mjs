import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const rows = (await c.query(`select table_name t, column_name c from information_schema.columns
  where table_schema='public' and data_type='double precision' order by 1,2`)).rows;
console.log('FLOAT8_TOTAL=' + rows.length);
console.log(rows.map(r => r.t + '.' + r.c).join(','));
await c.end();
