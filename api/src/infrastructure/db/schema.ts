import { pgTable, timestamp, varchar, jsonb, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

export const notes = pgTable('notes', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    folderId: varchar('folder_id', { length: 255 }).references(() => folders.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    content: jsonb('content').notNull(),
    createdAt: timestamp('created_at').notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const folders = pgTable('folders', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    normalizedName: varchar('normalized_name', { length: 100 }).notNull(),
    color: varchar('color', { length: 32 }),
    createdAt: timestamp('created_at').notNull(),
}, (table) => ({
    userNormalizedNameUnique: uniqueIndex('folders_user_id_normalized_name_unique').on(table.userId, table.normalizedName),
    userIdIdx: index('folders_user_id_idx').on(table.userId),
}));

export const tags = pgTable('tags', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    normalizedName: varchar('normalized_name', { length: 100 }).notNull(),
    color: varchar('color', { length: 32 }),
    createdAt: timestamp('created_at').notNull(),
}, (table) => ({
    userNormalizedNameUnique: uniqueIndex('tags_user_id_normalized_name_unique').on(table.userId, table.normalizedName),
    userIdIdx: index('tags_user_id_idx').on(table.userId),
}));

export const noteTags = pgTable('note_tags', {
    noteId: varchar('note_id', { length: 255 }).notNull().references(() => notes.id, { onDelete: 'cascade' }),
    tagId: varchar('tag_id', { length: 255 }).notNull().references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.noteId, table.tagId] }),
    tagIdIdx: index('note_tags_tag_id_idx').on(table.tagId),
}));

export const users = pgTable('users', {
    id: varchar('id', { length: 255 }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    resetToken: varchar('reset_token', { length: 255 }),
    resetTokenExpiry: timestamp('reset_token_expiry'),
    createdAt: timestamp('created_at').notNull(),
});
