/*
 * order_mail_log
 *
 * Hand-written, unlike its neighbours, because the table is new in this change and the generator
 * reads an existing database. It matches what initSchema() creates; the next `drizzle-kit pull` +
 * re-split will regenerate it and should produce the same thing.
 *
 * It has to be here at all because models/ is what drizzle-kit diffs the database against, so a
 * live table missing from this directory is generated as a DROP on the next migration.
 */
import { pgTable, text, foreignKey, integer, primaryKey } from 'drizzle-orm/pg-core';
import { tstz } from './_columns.js';
import { orders } from './order.model.js';

export const orderMailLog = pgTable("order_mail_log", {
	orderId: integer("order_id").notNull(),
	milestone: text().notNull(),
	sentAt: tstz("sent_at").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_mail_log_order_id_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.orderId, table.milestone], name: "order_mail_log_pkey" }),
]);
