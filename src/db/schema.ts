import { pgTable, text, integer, boolean, timestamp, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Blox Fruit Services - Database Schema
 * Built for Vercel Postgres / Neon with Drizzle ORM
 * Uses integer hundredths to eliminate floating point issues.
 */

export const services = pgTable('services', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  priceHundredths: integer('price_hundredths').notNull(),
  priceM: numeric('price_m', { precision: 12, scale: 2 }).notNull(),
  prerequisites: text('prerequisites'),
  exclusions: text('exclusions'),
  isPublished: boolean('is_published').notNull().default(false),
  needsConfirmation: boolean('needs_confirmation').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  publicToken: text('public_token').notNull().unique(),
  orderCode: text('order_code').notNull().unique(),
  serviceId: text('service_id').notNull().references(() => services.id),
  robloxUsername: text('roblox_username').notNull(),
  timezone: text('timezone').notNull(),
  availability: text('availability').notNull(),
  paymentType: text('payment_type').notNull(), // 'fruits' | 'gamepass' | 'combination'
  status: text('status').notNull().default('pending_review'),
  // 'pending_review' | 'accepted' | 'more_info_needed' | 'deposit_received' | 'in_progress' | 'completed' | 'fully_paid' | 'rejected' | 'cancelled'
  totalPriceHundredths: integer('total_price_hundredths').notNull(),
  depositHundredths: integer('deposit_hundredths').notNull(),
  remainingHundredths: integer('remaining_hundredths').notNull(),
  customerNote: text('customer_note'),
  staffNotes: text('staff_notes'),
  consentPublicProofs: boolean('consent_public_proofs').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  itemName: text('item_name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  proposedValueHundredths: integer('proposed_value_hundredths').notNull(),
  agreedValueHundredths: integer('agreed_value_hundredths'),
  verified: boolean('verified').notNull().default(false),
});

export const orderAudit = pgTable('order_audit', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  actor: text('actor').notNull(), // 'customer' | 'staff' | 'system'
  action: text('action').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // 'deposit' | 'remaining'
  amountHundredths: integer('amount_hundredths').notNull(),
  itemsJson: text('items_json').notNull(), // JSON list of items surrendered
  recordedBy: text('recorded_by').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const enquiries = pgTable('enquiries', {
  id: text('id').primaryKey(),
  source: text('source').notNull().default('website'), // 'website' | 'discord' | 'direct'
  customerName: text('customer_name'),
  robloxUsername: text('roblox_username').notNull(),
  discordTag: text('discord_tag'),
  orderCodeOrId: text('order_code_or_id'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'in_progress' | 'resolved'
  staffNotes: text('staff_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const serviceEvidence = pgTable('service_evidence', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  serviceId: text('service_id').notNull().references(() => services.id),
  evidenceType: text('evidence_type').notNull(), // 'screenshot' | 'video_link' | 'screen_share_session'
  mediaUrl: text('media_url').notNull(),
  notes: text('notes'),
  customerConsentPublic: boolean('customer_consent_public').notNull().default(false),
  staffApprovedPublic: boolean('staff_approved_public').notNull().default(false),
  isOngoing: boolean('is_ongoing').notNull().default(false),
  isCompleted: boolean('is_completed').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: text('reviewed_by'),
});

// Relations
export const ordersRelations = relations(orders, ({ one, many }) => ({
  service: one(services, {
    fields: [orders.serviceId],
    references: [services.id],
  }),
  items: many(orderItems),
  auditLogs: many(orderAudit),
  payments: many(payments),
  evidence: many(serviceEvidence),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const orderAuditRelations = relations(orderAudit, ({ one }) => ({
  order: one(orders, {
    fields: [orderAudit.orderId],
    references: [orders.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const serviceEvidenceRelations = relations(serviceEvidence, ({ one }) => ({
  order: one(orders, {
    fields: [serviceEvidence.orderId],
    references: [orders.id],
  }),
  service: one(services, {
    fields: [serviceEvidence.serviceId],
    references: [services.id],
  }),
}));

export const researchResults = pgTable('research_results', {
  id: text('id').primaryKey(),
  itemId: text('item_id'),
  itemName: text('item_name').notNull(),
  category: text('category').notNull(),
  currentValueM: text('current_value_m').notNull(),
  previousValueM: text('previous_value_m'),
  researchedValueM: text('researched_value_m').notNull(),
  changePercent: numeric('change_percent', { precision: 8, scale: 2 }),
  status: text('status').notNull().default('pending_approval'), // 'pending_approval' | 'approved' | 'rejected' | 'conflict'
  confidence: text('confidence').notNull().default('medium'), // 'high' | 'medium' | 'low' | 'conflict' | 'not_found'
  sourcesCount: integer('sources_count').notNull().default(0),
  discrepancyNote: text('discrepancy_note'),
  researchedAt: timestamp('researched_at', { withTimezone: true }).defaultNow().notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  notes: text('notes'),
});

export const researchSources = pgTable('research_sources', {
  id: text('id').primaryKey(),
  researchId: text('research_id').notNull().references(() => researchResults.id, { onDelete: 'cascade' }),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url').notNull(),
  reportedValueM: text('reported_value_m').notNull(),
  snippets: text('snippets'),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).defaultNow().notNull(),
});

export const valueHistory = pgTable('value_history', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull(),
  itemName: text('item_name').notNull(),
  oldValueM: text('old_value_m').notNull(),
  newValueM: text('new_value_m').notNull(),
  changeReason: text('change_reason').notNull(), // 'admin_approved_research' | 'manual_admin_edit' | 'initial_seed'
  sourceResearchId: text('source_research_id'),
  updatedBy: text('updated_by').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

export const researchResultsRelations = relations(researchResults, ({ many }) => ({
  sources: many(researchSources),
}));

export const researchSourcesRelations = relations(researchSources, ({ one }) => ({
  research: one(researchResults, {
    fields: [researchSources.researchId],
    references: [researchResults.id],
  }),
}));

