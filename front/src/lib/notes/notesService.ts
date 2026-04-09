import type { JSONContent } from '@tiptap/core';
import type { Note, NoteSummary } from '../types';
import { emitNotesChanged, emitOutboxChanged, localNotesRepository, type NoteFilters } from './localNotesRepository';
import { remoteNotesRepository, type NoteMutationPayload } from './remoteNotesRepository';
import {
    deleteValue,
    deriveContentText,
    getAllFromStore,
    getByKey,
    putValue,
    toLocalNoteRecord,
    withTransaction,
    type LocalMutationRecord,
    type LocalNoteRecord,
    type SyncMetaRecord,
} from './localDb';

const NOTES_SYNC_META_PREFIX = 'notes:lastSyncAt:';
const DELETED_SYNC_META_PREFIX = 'notes:deleted:lastSyncAt:';
const SEARCH_SYNC_META_PREFIX = 'notes:search:lastSyncAt:';
const SYNC_TTL_MS = 30_000;

export interface NoteInput {
    title: string;
    content: JSONContent;
    tags?: string[];
    folderId?: string | null;
}

function nowIso() {
    return new Date().toISOString();
}

async function getLastSyncAt(key: string): Promise<string | null> {
    return withTransaction(['sync_meta'], 'readonly', async ({ sync_meta }) => {
        const record = await getByKey<SyncMetaRecord>(sync_meta!, key);
        return record?.value ?? null;
    });
}

async function setLastSyncAt(key: string): Promise<void> {
    await withTransaction(['sync_meta'], 'readwrite', async ({ sync_meta }) => {
        await putValue(sync_meta!, { key, value: nowIso() });
    });
}

async function shouldRefresh(metaKey: string, force?: boolean): Promise<boolean> {
    if (force) {
        return true;
    }

    const lastSyncAt = await getLastSyncAt(metaKey);
    if (!lastSyncAt) {
        return true;
    }

    return Date.now() - new Date(lastSyncAt).getTime() > SYNC_TTL_MS;
}

function getScopedMetaKey(prefix: string, userId: string, suffix = '') {
    return `${prefix}${userId}${suffix}`;
}

function createLocalNoteRecord(userId: string, note: Note): LocalNoteRecord {
    return {
        ...toLocalNoteRecord(note, userId),
        syncState: 'pending',
    };
}

function buildLocalNote(record: LocalNoteRecord): Note {
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

function buildNotePayload(record: LocalNoteRecord): NoteMutationPayload {
    return {
        id: record.id,
        title: record.title,
        content: record.content,
        tags: (record.tags ?? []).map((tag) => tag.name),
        folderId: record.folderId ?? null,
    };
}

function createMutationRecord(userId: string, noteId: string, type: LocalMutationRecord['type'], payload?: unknown): LocalMutationRecord {
    const timestamp = nowIso();

    return {
        id: crypto.randomUUID(),
        userId,
        noteId,
        type,
        payload,
        status: 'pending',
        createdAt: timestamp,
        updatedAt: timestamp,
        retryCount: 0,
        lastError: null,
    };
}

async function enqueueMutation(userId: string, noteId: string, type: LocalMutationRecord['type'], payload?: unknown) {
    await withTransaction(['mutations'], 'readwrite', async ({ mutations }) => {
        const allMutations = await getAllFromStore<LocalMutationRecord>(mutations!);
        const sameNoteMutations = allMutations.filter((mutation) => mutation.userId === userId && mutation.noteId === noteId);

        if (type === 'update') {
            const createMutation = sameNoteMutations.find((mutation) => mutation.type === 'create' && mutation.status !== 'syncing');
            if (createMutation) {
                await putValue(mutations!, {
                    ...createMutation,
                    payload: {
                        ...(createMutation.payload ?? {}),
                        ...(payload ?? {}),
                    },
                    updatedAt: nowIso(),
                });
                return;
            }

            const pendingUpdate = sameNoteMutations.find((mutation) => mutation.type === 'update' && mutation.status !== 'syncing');
            if (pendingUpdate) {
                await putValue(mutations!, {
                    ...pendingUpdate,
                    payload,
                    status: 'pending',
                    updatedAt: nowIso(),
                    lastError: null,
                });
                return;
            }
        }

        await putValue(mutations!, createMutationRecord(userId, noteId, type, payload));
    });

    emitOutboxChanged();
}

export class NotesService {
    async listLocalNoteSummaries(userId: string, filters?: NoteFilters): Promise<NoteSummary[]> {
        return localNotesRepository.listNoteSummaries(userId, filters);
    }

    async searchLocalNoteSummaries(userId: string, query: string, filters?: NoteFilters): Promise<NoteSummary[]> {
        return localNotesRepository.searchNoteSummaries(userId, query, filters);
    }

    async listLocalDeletedNoteSummaries(userId: string): Promise<NoteSummary[]> {
        return localNotesRepository.listDeletedNoteSummaries(userId);
    }

    async getLocalNoteById(userId: string, id: string): Promise<Note | null> {
        return localNotesRepository.getNoteById(userId, id);
    }

    async refreshNotes(userId: string, token: string, filters?: NoteFilters, force?: boolean): Promise<NoteSummary[]> {
        const metaKey = getScopedMetaKey(NOTES_SYNC_META_PREFIX, userId, JSON.stringify(filters ?? {}));
        if (!(await shouldRefresh(metaKey, force))) {
            return localNotesRepository.listNoteSummaries(userId, filters);
        }

        const notes = await remoteNotesRepository.getNotes(token, filters);
        await localNotesRepository.upsertNotes(userId, notes);
        await setLastSyncAt(metaKey);
        return localNotesRepository.listNoteSummaries(userId, filters);
    }

    async refreshSearch(userId: string, token: string, query: string, filters?: NoteFilters, force?: boolean): Promise<NoteSummary[]> {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) {
            return this.refreshNotes(userId, token, filters, force);
        }

        const metaKey = getScopedMetaKey(SEARCH_SYNC_META_PREFIX, userId, `${normalizedQuery}:${JSON.stringify(filters ?? {})}`);
        if (!(await shouldRefresh(metaKey, force))) {
            return localNotesRepository.searchNoteSummaries(userId, normalizedQuery, filters);
        }

        const notes = await remoteNotesRepository.searchNotes(token, normalizedQuery, filters);
        await localNotesRepository.upsertNotes(userId, notes);
        await setLastSyncAt(metaKey);
        return localNotesRepository.searchNoteSummaries(userId, normalizedQuery, filters);
    }

    async refreshDeletedNotes(userId: string, token: string, force?: boolean): Promise<NoteSummary[]> {
        const metaKey = getScopedMetaKey(DELETED_SYNC_META_PREFIX, userId);
        if (!(await shouldRefresh(metaKey, force))) {
            return localNotesRepository.listDeletedNoteSummaries(userId);
        }

        const notes = await remoteNotesRepository.getDeletedNotes(token);
        await localNotesRepository.upsertNotes(userId, notes);
        await setLastSyncAt(metaKey);
        return localNotesRepository.listDeletedNoteSummaries(userId);
    }

    async getNoteById(userId: string, token: string, id: string, force?: boolean): Promise<Note | null> {
        const localNote = await localNotesRepository.getNoteById(userId, id);
        if (localNote && !force) {
            return localNote;
        }

        const remoteNote = await remoteNotesRepository.getNoteById(token, id);
        await localNotesRepository.upsertNote(userId, remoteNote);
        return remoteNote;
    }

    async createNoteLocally(userId: string, input: NoteInput): Promise<Note> {
        const timestamp = nowIso();
        const note: Note = {
            id: crypto.randomUUID(),
            title: input.title,
            content: input.content,
            contentText: deriveContentText({ ...input, id: '', createdAt: timestamp } as Note),
            tags: (input.tags ?? []).map((tag) => ({ id: `local-${tag}`, name: tag })),
            folderId: input.folderId ?? null,
            folder: null,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
            syncState: 'pending',
            syncError: null,
        };

        await withTransaction(['notes', 'mutations'], 'readwrite', async ({ notes, mutations }) => {
            await putValue(notes!, createLocalNoteRecord(userId, note));
            await putValue(mutations!, createMutationRecord(userId, note.id, 'create', buildNotePayload(createLocalNoteRecord(userId, note))));
        });

        emitNotesChanged();
        emitOutboxChanged();
        return note;
    }

    async updateNoteLocally(userId: string, id: string, updates: Partial<NoteInput>): Promise<Note> {
        const existing = await localNotesRepository.getNoteRecord(userId, id);
        if (!existing) {
            throw new Error('Note not found');
        }

        const timestamp = nowIso();
        const mergedRecord: LocalNoteRecord = {
            ...existing,
            title: updates.title ?? existing.title,
            content: updates.content ?? existing.content,
            tags: updates.tags ? updates.tags.map((tag) => ({ id: `local-${tag}`, name: tag })) : existing.tags,
            folderId: updates.folderId !== undefined ? updates.folderId : existing.folderId,
            updatedAt: timestamp,
            localUpdatedAt: timestamp,
            contentText: deriveContentText({
                ...existing,
                content: updates.content ?? existing.content,
                title: updates.title ?? existing.title,
            }),
            syncState: 'pending',
            syncError: null,
        };

        await withTransaction(['notes'], 'readwrite', async ({ notes }) => {
            await putValue(notes!, mergedRecord);
        });

        await enqueueMutation(userId, id, 'update', buildNotePayload(mergedRecord));
        emitNotesChanged();
        return buildLocalNote(mergedRecord);
    }

    async deleteNoteLocally(userId: string, id: string): Promise<void> {
        const existing = await localNotesRepository.getNoteRecord(userId, id);
        if (!existing) {
            throw new Error('Note not found');
        }

        const timestamp = nowIso();
        const deletedRecord: LocalNoteRecord = {
            ...existing,
            deletedAt: timestamp,
            updatedAt: timestamp,
            localUpdatedAt: timestamp,
            syncState: 'pending',
            syncError: null,
        };

        await withTransaction(['notes'], 'readwrite', async ({ notes }) => {
            await putValue(notes!, deletedRecord);
        });

        await enqueueMutation(userId, id, 'delete');
        emitNotesChanged();
    }

    async restoreNoteLocally(userId: string, id: string): Promise<void> {
        const existing = await localNotesRepository.getNoteRecord(userId, id);
        if (!existing) {
            throw new Error('Note not found');
        }

        const timestamp = nowIso();
        const restoredRecord: LocalNoteRecord = {
            ...existing,
            deletedAt: null,
            updatedAt: timestamp,
            localUpdatedAt: timestamp,
            syncState: 'pending',
            syncError: null,
        };

        await withTransaction(['notes'], 'readwrite', async ({ notes }) => {
            await putValue(notes!, restoredRecord);
        });

        await enqueueMutation(userId, id, 'restore');
        emitNotesChanged();
    }

    async permanentDeleteNoteLocally(userId: string, id: string): Promise<void> {
        const existing = await localNotesRepository.getNoteRecord(userId, id);
        if (!existing) {
            throw new Error('Note not found');
        }

        await withTransaction(['notes'], 'readwrite', async ({ notes }) => {
            await deleteValue(notes!, id);
        });

        await enqueueMutation(userId, id, 'permanent_delete');
        emitNotesChanged();
    }

    async listPendingMutations(userId: string): Promise<LocalMutationRecord[]> {
        return withTransaction(['mutations'], 'readonly', async ({ mutations }) => {
            const allMutations = await getAllFromStore<LocalMutationRecord>(mutations!);
            return allMutations
                .filter((mutation) => mutation.userId === userId)
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
    }

    async flushOutbox(userId: string, token: string): Promise<number> {
        const pendingMutations = await this.listPendingMutations(userId);
        let processed = 0;

        for (const mutation of pendingMutations) {
            if (mutation.status === 'syncing') {
                continue;
            }

            await withTransaction(['mutations'], 'readwrite', async ({ mutations }) => {
                await putValue(mutations!, { ...mutation, status: 'syncing', updatedAt: nowIso() });
            });

            try {
                if (mutation.type === 'create') {
                    const remoteNote = await remoteNotesRepository.createNote(token, mutation.payload as NoteMutationPayload);
                    await localNotesRepository.upsertNote(userId, remoteNote);
                } else if (mutation.type === 'update') {
                    const remoteNote = await remoteNotesRepository.updateNote(token, mutation.noteId, mutation.payload as Partial<NoteMutationPayload>);
                    await localNotesRepository.upsertNote(userId, remoteNote);
                } else if (mutation.type === 'delete') {
                    await remoteNotesRepository.deleteNote(token, mutation.noteId);
                    const record = await localNotesRepository.getNoteRecord(userId, mutation.noteId);
                    if (record) {
                        await localNotesRepository.saveNoteRecord({
                            ...record,
                            syncState: 'synced',
                            syncError: null,
                            serverUpdatedAt: nowIso(),
                        });
                    }
                } else if (mutation.type === 'restore') {
                    await remoteNotesRepository.restoreNote(token, mutation.noteId);
                    const remoteNote = await remoteNotesRepository.getNoteById(token, mutation.noteId);
                    await localNotesRepository.upsertNote(userId, remoteNote);
                } else if (mutation.type === 'permanent_delete') {
                    await remoteNotesRepository.permanentDeleteNote(token, mutation.noteId);
                    await localNotesRepository.removeNoteRecord(mutation.noteId);
                }

                await withTransaction(['mutations'], 'readwrite', async ({ mutations }) => {
                    await deleteValue(mutations!, mutation.id);
                });
                emitOutboxChanged();
                processed += 1;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Sync failed';
                const noteRecord = await localNotesRepository.getNoteRecord(userId, mutation.noteId);
                if (noteRecord) {
                    await localNotesRepository.saveNoteRecord({
                        ...noteRecord,
                        syncState: 'failed',
                        syncError: message,
                    });
                }

                await withTransaction(['mutations'], 'readwrite', async ({ mutations }) => {
                    await putValue(mutations!, {
                        ...mutation,
                        status: 'failed',
                        retryCount: mutation.retryCount + 1,
                        updatedAt: nowIso(),
                        lastError: message,
                    });
                });
                emitOutboxChanged();
                break;
            }
        }

        return processed;
    }

    async applyRemoteNoteEvent(userId: string, token: string, type: string, noteId?: string): Promise<void> {
        if (!noteId) {
            return;
        }

        if (type === 'NOTE_CREATED' || type === 'NOTE_UPDATED' || type === 'NOTE_RESTORED') {
            const remoteNote = await remoteNotesRepository.getNoteById(token, noteId);
            await localNotesRepository.upsertNote(userId, remoteNote);
            return;
        }

        if (type === 'NOTE_DELETED') {
            const existing = await localNotesRepository.getNoteRecord(userId, noteId);
            if (existing) {
                await localNotesRepository.saveNoteRecord({
                    ...existing,
                    deletedAt: existing.deletedAt ?? nowIso(),
                    syncState: 'synced',
                    syncError: null,
                    serverUpdatedAt: nowIso(),
                });
                return;
            }

            await this.refreshDeletedNotes(userId, token, true);
            return;
        }

        if (type === 'NOTE_PERMANENTLY_DELETED') {
            await localNotesRepository.removeNoteRecord(noteId);
        }
    }
}

export const notesService = new NotesService();
