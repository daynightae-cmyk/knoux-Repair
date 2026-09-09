import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table linked by Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

// System maintenance and repair action history
export const repairLogs = pgTable('repair_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  toolId: text('tool_id').notNull(),
  toolName: text('tool_name').notNull(),
  status: text('status').notNull(),
  durationMs: integer('duration_ms'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

// System telemetry and diagnostic snapshots
export const systemTelemetry = pgTable('system_telemetry', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  cpuLoad: integer('cpu_load'),
  ramUsedGb: text('ram_used_gb'),
  diskFreeGb: text('disk_free_gb'),
  osVersion: text('os_version'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Google Workspace integration activities
export const workspaceIntegrations = pgTable('workspace_integrations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  service: text('service').notNull(),
  resourceName: text('resource_name').notNull(),
  resourceId: text('resource_id'),
  resourceUrl: text('resource_url'),
  action: text('action').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  repairLogs: many(repairLogs),
  systemTelemetry: many(systemTelemetry),
  workspaceIntegrations: many(workspaceIntegrations),
}));

export const repairLogsRelations = relations(repairLogs, ({ one }) => ({
  user: one(users, {
    fields: [repairLogs.userId],
    references: [users.id],
  }),
}));

export const systemTelemetryRelations = relations(systemTelemetry, ({ one }) => ({
  user: one(users, {
    fields: [systemTelemetry.userId],
    references: [users.id],
  }),
}));

export const workspaceIntegrationsRelations = relations(workspaceIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [workspaceIntegrations.userId],
    references: [users.id],
  }),
}));
