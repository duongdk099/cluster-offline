import { randomUUID } from 'crypto';
import { Note, INoteRepository, NoteTag, NoteFolder } from '../domain/Note';

export class InMemoryNoteRepository implements INoteRepository {
    private notes: Map<string, Note> = new Map();
    private tagsByUser: Map<string, Map<string, NoteTag>> = new Map();
    private noteTagIds: Map<string, Set<string>> = new Map();
    private foldersByUser: Map<string, Map<string, NoteFolder>> = new Map();

    private normalizeFolderName(name: string): string {
        return name.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    private getOrCreateFolder(userId: string, folderName: string): NoteFolder {
        const normalized = this.normalizeFolderName(folderName);
        if (!normalized) {
            throw new Error('Folder name is required');
        }

        const userFolders = this.foldersByUser.get(userId) ?? new Map<string, NoteFolder>();
        this.foldersByUser.set(userId, userFolders);

        const existing = userFolders.get(normalized);
        if (existing) {
            return existing;
        }

        const folder: NoteFolder = {
            id: randomUUID(),
            name: folderName.trim().replace(/\s+/g, ' '),
            color: null,
        };

        userFolders.set(normalized, folder);
        return folder;
    }

    private getFolderById(userId: string, folderId?: string | null): NoteFolder | null {
        if (!folderId) {
            return null;
        }

        const userFolders = this.foldersByUser.get(userId);
        if (!userFolders) {
            return null;
        }

        for (const folder of userFolders.values()) {
            if (folder.id === folderId) {
                return folder;
            }
        }

        return null;
    }

    private normalizeTagName(name: string): string {
        return name.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    private getOrCreateTag(userId: string, tagName: string): NoteTag {
        const normalized = this.normalizeTagName(tagName);
        if (!normalized) {
            throw new Error('Tag name is required');
        }

        const userTags = this.tagsByUser.get(userId) ?? new Map<string, NoteTag>();
        this.tagsByUser.set(userId, userTags);

        const existing = userTags.get(normalized);
        if (existing) {
            return existing;
        }

        const tag: NoteTag = {
            id: randomUUID(),
            name: tagName.trim().replace(/\s+/g, ' '),
            color: null,
        };

        userTags.set(normalized, tag);
        return tag;
    }

    private getTagsForNote(noteId: string, userId: string): NoteTag[] {
        const tagIds = this.noteTagIds.get(noteId) ?? new Set<string>();
        const userTags = this.tagsByUser.get(userId);
        if (!userTags || tagIds.size === 0) {
            return [];
        }

        const tags: NoteTag[] = [];
        for (const tag of userTags.values()) {
            if (tagIds.has(tag.id)) {
                tags.push(tag);
            }
        }

        return tags;
    }

    private getUserNote(id: string, userId: string): Note | null {
        const note = this.notes.get(id);
        if (!note || note.userId !== userId) {
            return null;
        }

        return {
            ...note,
            tags: this.getTagsForNote(note.id, userId),
            folder: this.getFolderById(userId, note.folderId),
        };
    }

    async save(note: Note): Promise<void> {
        this.notes.set(note.id, { ...note, tags: undefined });

        if (note.folderId) {
            const folder = this.getFolderById(note.userId, note.folderId);
            if (!folder) {
                throw new Error('Folder not found');
            }
        }

        if (note.tags?.length) {
            for (const tag of note.tags) {
                await this.addTagToNote(note.id, note.userId, tag.name);
            }
        }
    }

    async findById(id: string, userId: string): Promise<Note | null> {
        return this.getUserNote(id, userId);
    }

    async findAll(userId: string): Promise<Note[]> {
        return Array.from(this.notes.values())
            .filter((note) => note.userId === userId && !note.deletedAt)
            .map((note) => ({
                ...note,
                tags: this.getTagsForNote(note.id, userId),
                folder: this.getFolderById(userId, note.folderId),
            }));
    }

    async findDeleted(userId: string): Promise<Note[]> {
        return Array.from(this.notes.values())
            .filter((note) => note.userId === userId && !!note.deletedAt)
            .map((note) => ({
                ...note,
                tags: this.getTagsForNote(note.id, userId),
                folder: this.getFolderById(userId, note.folderId),
            }));
    }

    async update(id: string, userId: string, noteData: Partial<Note>): Promise<void> {
        const note = this.getUserNote(id, userId);
        if (note) {
            this.notes.set(id, { ...note, ...noteData, tags: undefined });
        }
    }

    async restore(id: string, userId: string): Promise<void> {
        const note = this.getUserNote(id, userId);
        if (note) {
            this.notes.set(id, { ...note, deletedAt: null });
        }
    }

    async delete(id: string, userId: string): Promise<void> {
        const note = this.getUserNote(id, userId);
        if (note) {
            this.notes.set(id, { ...note, deletedAt: new Date() });
        }
    }

    async permanentDelete(id: string, userId: string): Promise<void> {
        const note = this.getUserNote(id, userId);
        if (note) {
            this.notes.delete(id);
            this.noteTagIds.delete(id);
        }
    }

    async search(userId: string, query: string): Promise<Note[]> {
        const normalizedQuery = query.toLowerCase().trim();
        if (!normalizedQuery) {
            return this.findAll(userId);
        }

        return Array.from(this.notes.values()).filter((note) => {
            if (note.userId !== userId || note.deletedAt) {
                return false;
            }

            const titleMatch = note.title.toLowerCase().includes(normalizedQuery);
            const contentMatch = JSON.stringify(note.content ?? '')
                .toLowerCase()
                .includes(normalizedQuery);

            return titleMatch || contentMatch;
        }).map((note) => ({
            ...note,
            tags: this.getTagsForNote(note.id, userId),
            folder: this.getFolderById(userId, note.folderId),
        }));
    }

    async listTags(userId: string): Promise<NoteTag[]> {
        const userTags = this.tagsByUser.get(userId);
        if (!userTags) {
            return [];
        }

        const activeTagIds = new Set<string>();
        for (const note of this.notes.values()) {
            if (note.userId !== userId || note.deletedAt) {
                continue;
            }

            const tagIds = this.noteTagIds.get(note.id);
            if (!tagIds) {
                continue;
            }

            for (const tagId of tagIds) {
                activeTagIds.add(tagId);
            }
        }

        return Array.from(userTags.values())
            .filter((tag) => activeTagIds.has(tag.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    async addTagToNote(noteId: string, userId: string, tagName: string): Promise<NoteTag> {
        const note = this.notes.get(noteId);
        if (!note || note.userId !== userId) {
            throw new Error('Note not found');
        }

        const tag = this.getOrCreateTag(userId, tagName);
        const current = this.noteTagIds.get(noteId) ?? new Set<string>();
        current.add(tag.id);
        this.noteTagIds.set(noteId, current);
        return tag;
    }

    async removeTagFromNote(noteId: string, userId: string, tagId: string): Promise<void> {
        const note = this.notes.get(noteId);
        if (!note || note.userId !== userId) {
            throw new Error('Note not found');
        }

        const current = this.noteTagIds.get(noteId);
        if (current) {
            current.delete(tagId);
        }
    }

    async findByTag(userId: string, tagNameOrId: string): Promise<Note[]> {
        const normalized = this.normalizeTagName(tagNameOrId);
        const userTags = this.tagsByUser.get(userId);
        if (!userTags) {
            return [];
        }

        let targetTagId: string | null = null;
        for (const [tagNormalizedName, tag] of userTags.entries()) {
            if (tag.id === tagNameOrId || tagNormalizedName === normalized) {
                targetTagId = tag.id;
                break;
            }
        }

        if (!targetTagId) {
            return [];
        }

        return Array.from(this.notes.values())
            .filter((note) => {
                if (note.userId !== userId || note.deletedAt) {
                    return false;
                }

                const tagIds = this.noteTagIds.get(note.id);
                return !!tagIds?.has(targetTagId);
            })
            .map((note) => ({
                ...note,
                tags: this.getTagsForNote(note.id, userId),
                folder: this.getFolderById(userId, note.folderId),
            }));
    }

    async listFolders(userId: string): Promise<NoteFolder[]> {
        const userFolders = this.foldersByUser.get(userId);
        if (!userFolders) {
            return [];
        }

        return Array.from(userFolders.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    async createFolder(userId: string, name: string): Promise<NoteFolder> {
        return this.getOrCreateFolder(userId, name);
    }

    async assignFolderToNote(noteId: string, userId: string, folderId: string | null): Promise<void> {
        const note = this.notes.get(noteId);
        if (!note || note.userId !== userId) {
            throw new Error('Note not found');
        }

        if (folderId && !this.getFolderById(userId, folderId)) {
            throw new Error('Folder not found');
        }

        this.notes.set(noteId, { ...note, folderId });
    }

    async findByFolder(userId: string, folderId: string): Promise<Note[]> {
        return Array.from(this.notes.values())
            .filter((note) => note.userId === userId && !note.deletedAt && note.folderId === folderId)
            .map((note) => ({
                ...note,
                tags: this.getTagsForNote(note.id, userId),
                folder: this.getFolderById(userId, note.folderId),
            }));
    }
}
