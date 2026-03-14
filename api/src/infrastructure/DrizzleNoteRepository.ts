import { Note, INoteRepository } from '../domain/Note';
import { db } from './db';
import { notes } from './db/schema';
import { eq, and, sql, ilike, isNull } from 'drizzle-orm';

export class DrizzleNoteRepository implements INoteRepository {
    async save(note: Note): Promise<void> {
        await db.insert(notes).values({
            id: note.id,
            userId: note.userId,
            title: note.title,
            content: note.content,
            createdAt: note.createdAt,
            deletedAt: note.deletedAt ?? null,
        });
    }

    async findById(id: string, userId: string): Promise<Note | null> {
        const result = await db.query.notes.findFirst({
            where: and(eq(notes.id, id), eq(notes.userId, userId), isNull(notes.deletedAt)),
        });

        if (!result) return null;
        return {
            id: result.id,
            userId: result.userId,
            title: result.title,
            content: result.content,
            createdAt: result.createdAt,
            deletedAt: result.deletedAt,
        };
    }

    async findAll(userId: string): Promise<Note[]> {
        const results = await db.query.notes.findMany({
            where: and(eq(notes.userId, userId), isNull(notes.deletedAt)),
            orderBy: (notes, { desc }) => [desc(notes.createdAt)],
        });
        return results.map(row => ({
            id: row.id,
            userId: row.userId,
            title: row.title,
            content: row.content,
            createdAt: row.createdAt,
            deletedAt: row.deletedAt,
        }));
    }

    async findDeleted(userId: string): Promise<Note[]> {
        const results = await db.query.notes.findMany({
            where: and(eq(notes.userId, userId), sql`${notes.deletedAt} IS NOT NULL`),
            orderBy: (notes, { desc }) => [desc(notes.deletedAt)],
        });
        return results.map(row => ({
            id: row.id,
            userId: row.userId,
            title: row.title,
            content: row.content,
            createdAt: row.createdAt,
            deletedAt: row.deletedAt,
        }));
    }

    async update(id: string, userId: string, noteData: Partial<Note>): Promise<void> {
        await db.update(notes)
            .set(noteData)
            .where(and(eq(notes.id, id), eq(notes.userId, userId)));
    }

    async restore(id: string, userId: string): Promise<void> {
        await db.update(notes)
            .set({ deletedAt: null })
            .where(and(eq(notes.id, id), eq(notes.userId, userId)));
    }

    async delete(id: string, userId: string): Promise<void> {
        // Soft delete - set deletedAt timestamp
        await db.update(notes)
            .set({ deletedAt: new Date() })
            .where(and(eq(notes.id, id), eq(notes.userId, userId)));
    }

    async permanentDelete(id: string, userId: string): Promise<void> {
        // Hard delete - remove from database
        await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
    }

    async search(userId: string, query: string): Promise<Note[]> {
        const searchTerm = `%${query}%`;
        const results = await db.query.notes.findMany({
            where: and(
                eq(notes.userId, userId),
                isNull(notes.deletedAt),
                sql`(${notes.title} ILIKE ${searchTerm} OR ${notes.content}::text ILIKE ${searchTerm})`
            ),
            orderBy: (notes, { desc }) => [desc(notes.createdAt)],
        });
        return results.map(row => ({
            id: row.id,
            userId: row.userId,
            title: row.title,
            content: row.content,
            createdAt: row.createdAt,
            deletedAt: row.deletedAt,
        }));
    }
}
