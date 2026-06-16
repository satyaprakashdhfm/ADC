# Prisma ORM Migration — Design Spec

**Date:** 2026-06-17  
**Project:** `adc-cookies-backend-node`  
**Scope:** Replace all raw `pg` SQL queries with Prisma ORM across the entire backend.

---

## Problem

All database access uses raw SQL strings via thin wrappers (`getOne`, `getAll`, `query` in `src/db.js`). This means:
- No type safety or autocomplete on query results
- Manual snake_case → camelCase mapping in `src/serializers.js` (150+ lines of boilerplate)
- Error-prone string interpolation for dynamic queries
- Schema lives only in `initSchema()` — no single source of truth

---

## Decision

Use **Prisma ORM** with the **introspect-existing-DB** approach (`prisma db pull` from Supabase). No schema changes, no data loss.

---

## Architecture

### New file layout

```
prisma/
  schema.prisma          ← auto-generated from Supabase via `prisma db pull`

src/
  prisma.js              ← NEW: singleton PrismaClient (global-cached for Vercel serverless)
  db.js                  ← SIMPLIFIED: remove pool/query/getOne/getAll/initSchema; keep withTransaction wrapper using prisma.$transaction
  routes/auth.js         ← updated: prisma.user.*
  routes/products.js     ← updated: prisma.product.*
  routes/cart.js         ← updated: prisma.cart.* / prisma.cartItem.*
  routes/orders.js       ← updated: prisma.order.* / prisma.orderItem.*
  routes/addresses.js    ← updated: prisma.address.*
  routes/coupons.js      ← updated: prisma.coupon.*
  routes/admin.js        ← updated: prisma.* across multiple models
  routes/contact.js      ← updated: prisma.contactMessage.*
  seed.js                ← updated: prisma.user.create etc.
  serializers.js         ← DELETED: Prisma handles camelCase via @map / @@map in schema
  server.js              ← remove initSchema() call; keep everything else
```

### PrismaClient singleton (`src/prisma.js`)

```js
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

This prevents connection exhaustion on Vercel serverless by reusing a single instance per cold start.

---

## Schema Approach

Run `prisma db pull` to introspect the live Supabase database. This generates `prisma/schema.prisma` with all 12 tables. Then add `@map` / `@@map` directives so Prisma field names are camelCase while DB columns stay snake_case.

Tables to introspect:
- `users`, `addresses`, `products`, `coupons`
- `cart`, `cart_items`
- `orders`, `order_items`, `order_tracking`
- `payments`, `coupon_usage`, `contact_messages`

---

## Route Migration Patterns

| Raw SQL pattern | Prisma equivalent |
|---|---|
| `getOne('SELECT * FROM users WHERE email=$1', [e])` | `prisma.user.findUnique({ where: { email: e } })` |
| `getAll('SELECT * FROM products WHERE is_available=TRUE')` | `prisma.product.findMany({ where: { isAvailable: true } })` |
| `getOne('INSERT INTO users ... RETURNING *', [...])` | `prisma.user.create({ data: { ... } })` |
| `query('UPDATE ... SET updated_at=$1 WHERE id=$2', [...])` | `prisma.model.update({ where: { id }, data: { updatedAt: new Date() } })` |
| `query('DELETE FROM ... WHERE id=$1', [id])` | `prisma.model.delete({ where: { id } })` |
| `withTransaction(async client => {...})` | `prisma.$transaction(async tx => { ... })` |

All serializer calls (e.g. `serializeProduct(row)`) are removed — Prisma returns objects with camelCase fields directly.

---

## Transactions

Replace `withTransaction` in `db.js` with Prisma's interactive transactions:

```js
// Before
await withTransaction(async client => {
  await client.query('INSERT INTO orders ...', [...]);
  await client.query('INSERT INTO order_items ...', [...]);
});

// After
await prisma.$transaction(async tx => {
  await tx.order.create({ data: { ... } });
  await tx.orderItem.createMany({ data: [...] });
});
```

---

## What Gets Deleted

- `src/serializers.js` — entirely removed once all routes are migrated
- `initSchema()` in `src/db.js` — removed (Prisma owns schema via `prisma db push` / migrations)
- The `pool`, `query`, `getOne`, `getAll`, `nowIso` exports from `src/db.js` — removed after migration

---

## One-Time Setup Commands

```bash
npm install prisma @prisma/client
npx prisma init                    # creates prisma/schema.prisma with datasource
npx prisma db pull                 # introspects Supabase → fills schema.prisma
# (manually add @map / @@map directives for camelCase field names)
npx prisma generate                # generates typed PrismaClient
```

These are run once by the developer. After that, `prisma generate` runs as needed when the schema changes.

---

## Out of Scope

- Changing the REST API contract — request/response shapes stay identical
- Frontend changes — none required
- Adding new features or endpoints
- Switching the database engine
