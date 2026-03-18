import { randomUUID } from 'crypto';
import { Note, INoteRepository, NoteTag, NoteFolder } from '../domain/Note';
import { db } from './db';
import { notes, tags, noteTags, folders } from './db/schema';
import { eq, and, sql, isNull, inArray, desc, or } from 'drizzle-orm';

const MAX_TAG_NAME_LENGTH = 100;
const MAX_FOLDER_NAME_LENGTH = 100;

function normalizeTagName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeFolderName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export class DrizzleNoteRepository implements INoteRepository {
    private async attachTagsAndFolders(rows: typeof notes.$inferSelect[], userId: string): Promise<Note[]> {
        if (rows.length === 0) {
            return [];
        }

        const noteIds = rows.map((row) => row.id);
        const tagRows = await db
            .select({
                noteId: noteTags.noteId,
                id: tags.id,
                name: tags.name,
                color: tags.color,
            })
            .from(noteTags)
            .innerJoin(tags, eq(noteTags.tagId, tags.id))
            .where(and(inArray(noteTags.noteId, noteIds), eq(tags.userId, userId)));

        const tagsByNoteId = new Map<string, NoteTag[]>();
        for (const row of tagRows) {
            const current = tagsByNoteId.get(row.noteId) ?? [];
            current.push({ id: row.id, name: row.name, color: row.color });
            tagsByNoteId.set(row.noteId, current);
        }

        const folderIds = [...new Set(rows.map((row) => row.folderId).filter(Boolean))] as string[];
        const foldersById = new Map<string, NoteFolder>();
        if (folderIds.length > 0) {
            const folderRows = await db.query.folders.findMany({
                where: and(eq(folders.userId, userId), inArray(folders.id, folderIds)),
            });

            for (const folder of folderRows) {
                foldersById.set(folder.id, {
                    id: folder.id,
                    name: folder.name,
                    color: folder.color,
                });
            }
        }

        return rows.map((row) => ({
            id: row.id,
            userId: row.userId,
            title: row.title,
            content: row.content,
            createdAt: row.createdAt,
            deletedAt: row.deletedAt,
            folderId: row.folderId,
            folder: row.folderId ? foldersById.get(row.folderId) ?? null : null,
            tags: tagsByNoteId.get(row.id) ?? [],
        }));
    }

    private async getOrCreateTag(userId: string, rawTagName: string): Promise<typeof tags.$inferSelect> {
        const normalizedName = normalizeTagName(rawTagName);
        const displayName = rawTagName.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_NAME_LENGTH);

        const existing = await db.query.tags.findFirst({
            where: and(eq(tags.userId, userId), eq(tags.normalizedName, normalizedName)),
        });

        if (existing) {
            return existing;
        }

        const id = randomUUID();
        await db
            .insert(tags)
            .values({
                id,
                userId,
                name: displayName,
                normalizedName,
                createdAt: new Date(),
            })
            .onConflictDoNothing({ target: [tags.userId, tags.normalizedName] });

        const created = await db.query.tags.findFirst({
            where: and(eq(tags.userId, userId), eq(tags.normalizedName, normalizedName)),
        });

        if (!created) {
            throw new Error('Failed to create tag');
        }

        return created;
    }

    private async getOrCreateFolder(userId: string, rawFolderName: string): Promise<typeof folders.$inferSelect> {
        const normalizedName = normalizeFolderName(rawFolderName);
        const displayName = rawFolderName.trim().replace(/\s+/g, ' ').slice(0, MAX_FOLDER_NAME_LENGTH);

        const existing = await db.query.folders.findFirst({
            where: and(eq(folders.userId, userId), eq(folders.normalizedName, normalizedName)),
        });

        if (existing) {
            return existing;
        }

        const id = randomUUID();
        await db
            .insert(folders)
            .values({
                id,
                userId,
                name: displayName,
                normalizedName,
                createdAt: new Date(),
            })
            .onConflictDoNothing({ target: [folders.userId, folders.normalizedName] });

        const created = await db.query.folders.findFirst({
            where: and(eq(folders.userId, userId), eq(folders.normalizedName, normalizedName)),
        });

        if (!created) {
            throw new Error('Failed to create folder');
        }

        return created;
    }

    async save(note: Note): Promise<void> {
        await db.insert(notes).values({
            id: note.id,
            userId: note.userId,
            folderId: note.folderId ?? null,
            title: note.title,
            content: note.content,
            createdAt: note.createdAt,
            deletedAt: note.deletedAt ?? null,
        });
    }

    async findById(id: string, userId: string): Promise<Note | null> {
        const row = await db.query.notes.findFirst({
            where: and(eq(notes.id, id), eq(notes.userId, userId), isNull(notes.deletedAt)),
        });

        if (!row) return null;
        const [note] = await this.attachTagsAndFolders([row], userId);
        return note ?? null;
    }

    async findAll(userId: string): Promise<Note[]> {
        const rows = await db.query.notes.findMany({
            where: and(eq(notes.userId, userId), isNull(notes.deletedAt)),
            orderBy: [desc(notes.createdAt)],
        });
        return this.attachTagsAndFolders(rows, userId);
    }

    async findDeleted(userId: string): Promise<Note[]> {
        const rows = await db.query.notes.findMany({
            where: and(eq(notes.userId, userId), sql`${notes.deletedAt} IS NOT NULL`),
            orderBy: [desc(notes.deletedAt)],
        });
        return this.attachTagsAndFolders(rows, userId);
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
        const rows = await db.query.notes.findMany({
            where: and(
                eq(notes.userId, userId),
                isNull(notes.deletedAt),
                sql`(${notes.title} ILIKE ${searchTerm} OR ${notes.content}::text ILIKE ${searchTerm})`
            ),
            orderBy: [desc(notes.createdAt)],
        });
        return this.attachTagsAndFolders(rows, userId);
    }

    async listTags(userId: string): Promise<NoteTag[]> {
        const rows = await db
            .select({
                id: tags.id,
                name: tags.name,
                color: tags.color,
            })
            .from(tags)
            .innerJoin(noteTags, eq(noteTags.tagId, tags.id))
            .innerJoin(notes, eq(notes.id, noteTags.noteId))
            .where(and(eq(tags.userId, userId), eq(notes.userId, userId), isNull(notes.deletedAt)))
            .groupBy(tags.id, tags.name, tags.color)
            .orderBy(tags.name);

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color,
        }));
    }

    async addTagToNote(noteId: string, userId: string, tagName: string): Promise<NoteTag> {
        const note = await db.query.notes.findFirst({
            where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
        });

        if (!note) {
            throw new Error('Note not found');
        }

        const tag = await this.getOrCreateTag(userId, tagName);

        await db
            .insert(noteTags)
            .values({
                noteId,
                tagId: tag.id,
                createdAt: new Date(),
            })
            .onConflictDoNothing();

        return {
            id: tag.id,
            name: tag.name,
            color: tag.color,
        };
    }

    async removeTagFromNote(noteId: string, userId: string, tagId: string): Promise<void> {
        const note = await db.query.notes.findFirst({
            where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
        });

        if (!note) {
            throw new Error('Note not found');
        }

        await db.delete(noteTags).where(and(eq(noteTags.noteId, noteId), eq(noteTags.tagId, tagId)));
    }

    async findByTag(userId: string, tagNameOrId: string): Promise<Note[]> {
        const normalizedName = normalizeTagName(tagNameOrId);

        const rows = await db
            .select({ noteId: noteTags.noteId })
            .from(noteTags)
            .innerJoin(tags, eq(noteTags.tagId, tags.id))
            .where(
                and(
                    eq(tags.userId, userId),
                    or(eq(tags.id, tagNameOrId), eq(tags.normalizedName, normalizedName)),
                ),
            );

        const noteIds = [...new Set(rows.map((row) => row.noteId))];
        if (noteIds.length === 0) {
            return [];
        }

        const noteRows = await db.query.notes.findMany({
            where: and(eq(notes.userId, userId), isNull(notes.deletedAt), inArray(notes.id, noteIds)),
            orderBy: [desc(notes.createdAt)],
        });

        return this.attachTagsAndFolders(noteRows, userId);
    }

    async listFolders(userId: string): Promise<NoteFolder[]> {
        const rows = await db.query.folders.findMany({
            where: eq(folders.userId, userId),
            orderBy: [folders.name],
        });

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color,
        }));
    }

    async createFolder(userId: string, name: string): Promise<NoteFolder> {
        const folder = await this.getOrCreateFolder(userId, name);
        return {
            id: folder.id,
            name: folder.name,
            color: folder.color,
        };
    }

    async assignFolderToNote(noteId: string, userId: string, folderId: string | null): Promise<void> {
        const note = await db.query.notes.findFirst({
            where: and(eq(notes.id, noteId), eq(notes.userId, userId)),
        });

        if (!note) {
            throw new Error('Note not found');
        }

        if (folderId) {
            const folder = await db.query.folders.findFirst({
                where: and(eq(folders.id, folderId), eq(folders.userId, userId)),
            });

            if (!folder) {
                throw new Error('Folder not found');
            }
        }

        await db
            .update(notes)
            .set({ folderId })
            .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
    }

    async findByFolder(userId: string, folderId: string): Promise<Note[]> {
        const rows = await db.query.notes.findMany({
            where: and(
                eq(notes.userId, userId),
                isNull(notes.deletedAt),
                eq(notes.folderId, folderId),
            ),
            orderBy: [desc(notes.createdAt)],
        });

        return this.attachTagsAndFolders(rows, userId);
    }
}
