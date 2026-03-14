import { pgTable, text, timestamp, varchar, jsonb } from 'drizzle-orm/pg-core';

export const notes = pgTable('notes', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    content: jsonb('content').notNull(),
    createdAt: timestamp('created_at').notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const users = pgTable('users', {
    id: varchar('id', { length: 255 }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    resetToken: varchar('reset_token', { length: 255 }),
    resetTokenExpiry: timestamp('reset_token_expiry'),
    createdAt: timestamp('created_at').notNull(),
});
