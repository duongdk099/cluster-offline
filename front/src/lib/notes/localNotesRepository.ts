import type { Note, NoteSummary } from '../types';
import {
    deleteValue,
    filterNoteFolder,
    filterNoteTags,
    getByKey,
    putValue,
    readAllFromIndex,
    toLocalNoteRecord,
    toLocalNoteSummaryRecord,
    withTransaction,
    type LocalNoteRecord,
    type LocalNoteSummaryRecord,
} from './localDb';

const NOTES_CHANGED_EVENT = 'notes-local-store-changed';
const NOTES_OUTBOX_EVENT = 'notes-local-outbox-changed';

export type NoteFilters = {
    tag?: string;
    folder?: string;
};

export function emitNotesChanged() {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new Event(NOTES_CHANGED_EVENT));
}

export function emitOutboxChanged() {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new Event(NOTES_OUTBOX_EVENT));
}

function toClientNote(record: LocalNoteRecord): Note {
    return {
        id: record.id,
        title: record.title,
        content: record.content,
        contentText: record.contentText,
        tags: record.tags,
        folderId: record.folderId,
        folder: record.folder,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt,
        syncState: record.syncState,
        syncError: record.syncError,
    };
}

function toClientSummary(record: LocalNoteSummaryRecord): NoteSummary {
    return {
        id: record.id,
        title: record.title,
        snippet: record.snippet,
        previewImage: record.previewImage,
        contentText: record.contentText,
        tags: record.tags,
        folderId: record.folderId,
        folder: record.folder,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt,
        syncState: record.syncState,
        syncError: record.syncError,
    };
}

export class LocalNotesRepository {
    async listNoteSummaries(userId: string, filters?: NoteFilters): Promise<NoteSummary[]> {
        return withTransaction(['note_summaries'], 'readonly', async ({ note_summaries }) => {
            const summaries = await readAllFromIndex<LocalNoteSummaryRecord>(
                note_summaries!,
                'by_user_updated_at',
                IDBKeyRange.bound([userId, ''], [userId, '\uffff']),
                'prev',
            );

            return summaries
                .filter((note) => !note.deletedAt)
                .filter((note) => filterNoteTags(note.tags, filters?.tag))
                .filter((note) => filterNoteFolder(note, filters?.folder));
        }).then((summaries) => summaries.map(toClientSummary));
    }

    async searchNoteSummaries(userId: string, query: string, filters?: NoteFilters): Promise<NoteSummary[]> {
        const normalizedQuery = query.trim().toLowerCase();
        const notes = await this.listNoteSummaries(userId, filters);

        if (!normalizedQuery) {
            return notes;
        }

        return notes.filter((note) => {
            const haystack = [
                note.title,
                note.contentText ?? '',
                note.snippet,
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(normalizedQuery);
        });
    }

    async listDeletedNoteSummaries(userId: string): Promise<NoteSummary[]> {
        return withTransaction(['note_summaries'], 'readonly', async ({ note_summaries }) => {
            const summaries = await readAllFromIndex<LocalNoteSummaryRecord>(
                note_summaries!,
                'by_user_updated_at',
                IDBKeyRange.bound([userId, ''], [userId, '\uffff']),
                'prev',
            );

            return summaries.filter((note) => !!note.deletedAt).map(toClientSummary);
        });
    }

    async getNoteById(userId: string, id: string): Promise<Note | null> {
        return withTransaction(['notes'], 'readonly', async ({ notes }) => {
            const record = await getByKey<LocalNoteRecord>(notes!, id);
            if (!record || record.userId !== userId || record.deletedAt) {
                return null;
            }

            return toClientNote(record);
        });
    }

    async upsertNotes(userId: string, notes: Note[]): Promise<void> {
        await withTransaction(['notes', 'note_summaries'], 'readwrite', async ({ notes: notesStore, note_summaries }) => {
            for (const note of notes) {
                await putValue(notesStore!, toLocalNoteRecord(note, userId));
                await putValue(note_summaries!, toLocalNoteSummaryRecord(note, userId));
            }
        });

        emitNotesChanged();
    }

    async upsertNote(userId: string, note: Note): Promise<void> {
        await this.upsertNotes(userId, [note]);
    }

    async getNoteRecord(userId: string, id: string): Promise<LocalNoteRecord | null> {
        return withTransaction(['notes'], 'readonly', async ({ notes }) => {
            const record = await getByKey<LocalNoteRecord>(notes!, id);
            if (!record || record.userId !== userId) {
                return null;
            }

            return record;
        });
    }

    async saveNoteRecord(record: LocalNoteRecord): Promise<void> {
        await withTransaction(['notes', 'note_summaries'], 'readwrite', async ({ notes, note_summaries }) => {
            await putValue(notes!, record);
            await putValue(note_summaries!, toLocalNoteSummaryRecord(record, record.userId));
        });

        emitNotesChanged();
    }

    async removeNoteRecord(id: string): Promise<void> {
        await withTransaction(['notes', 'note_summaries'], 'readwrite', async ({ notes, note_summaries }) => {
            await deleteValue(notes!, id);
            await deleteValue(note_summaries!, id);
        });

        emitNotesChanged();
    }
}

export const localNotesRepository = new LocalNotesRepository();
export { NOTES_CHANGED_EVENT, NOTES_OUTBOX_EVENT };
