import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(), creatorKey: text("creator_key").notNull().unique(),
  state: text("state").notNull(), version: integer("version").notNull().default(0),
  expiresAt: integer("expires_at").notNull(),
}, t => [index("rooms_expiry").on(t.expiresAt)]);
export const presence = sqliteTable("presence", {
  key: text("key").primaryKey(), code: text("code").notNull(),
  playerId: text("player_id").notNull(), seenAt: integer("seen_at").notNull(),
}, t => [index("presence_code").on(t.code)]);
export const limits = sqliteTable("limits", {
  key: text("key").primaryKey(), hits: integer("hits").notNull(), expiresAt: integer("expires_at").notNull(),
}, t => [index("limits_expiry").on(t.expiresAt)]);
