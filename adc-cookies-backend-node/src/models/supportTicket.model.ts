/*
 * support_tickets
 *
 * Hand-written rather than generated, because this table is new here and does not yet exist in the
 * introspected schema. Regenerate the rest with scripts/split-models.mjs as usual; this file joins
 * them on the next pull.
 */
import { pgTable, serial, integer, text, jsonb, index } from 'drizzle-orm/pg-core';
import { tstz } from './_columns.js';
import { users } from './user.model.js';
import { orders } from './order.model.js';

export const supportTickets = pgTable('support_tickets', {
  id: serial().primaryKey().notNull(),
  /* NOT NULL on purpose: a ticket always belongs to the signed-in customer whose session raised it,
     so there is no shape in which one account can file against another. */
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  subject: text().notNull(),
  details: text().notNull(),
  category: text().default('GENERAL').notNull(),
  status: text().default('OPEN').notNull(),
  /** The few turns that led here, so whoever picks it up sees what was actually asked. */
  transcript: jsonb(),
  createdAt: tstz('created_at').notNull(),
  updatedAt: tstz('updated_at').notNull(),
}, (table) => [
  index('idx_support_tickets_status').on(table.status, table.createdAt),
  index('idx_support_tickets_user').on(table.userId),
]);
