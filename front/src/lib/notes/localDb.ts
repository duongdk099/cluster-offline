import type { Note, NoteSummary, NoteTag } from '../types';
import { buildNoteSnippet, extractFirstImage } from '../utils';

const DB_NAME = 'notesaides-local';
const DB_VERSION = 3;
const NOTES_STORE = 'notes';
const NOTE_SUMMARIES_STORE = 'note_summaries';
const MUTATIONS_STORE = 'mutations';
const META_STORE = 'sync_meta';

export type SyncState = 'synced' | 'cached' | 'pending' | 'syncing' | 'failed' | 'conflict';
export type MutationStatus = 'pending' | 'syncing' | 'failed';
export type NoteMutationType = 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete';

export interface LocalNoteRecord extends Note {
    userId: string;
    syncState: SyncState;
    localUpdatedAt: string;
    serverUpdatedAt: string | null;
    syncError: string | null;
}

export interface LocalNoteSummaryRecord extends NoteSummary {
    userId: string;
    normalizedTitle: string;
    normalizedContentText: string;
}

export interface LocalMutationRecord {
    id: string;
    userId: string;
    noteId: string;
    type: NoteMutationType;
    payload?: unknown;
    status: MutationStatus;
    createdAt: string;
    updatedAt: string;
    retryCount: number;
    lastError: string | null;
}

export interface SyncMetaRecord {
    key: string;
    value: string;
}

interface NotesDbSchema {
    notes: LocalNoteRecord;
    note_summaries: LocalNoteSummaryRecord;
    mutations: LocalMutationRecord;
    sync_meta: SyncMetaRecord;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
}

function createStoreIndexes(store: IDBObjectStore) {
    store.createIndex('by_user', 'userId', { unique: false });
    store.createIndex('by_user_updated_at', ['userId', 'updatedAt'], { unique: false });
    store.createIndex('by_user_deleted_at', ['userId', 'deletedAt'], { unique: false });
    store.createIndex('by_user_folder', ['userId', 'folderId'], { unique: false });
}

function createSummaryStoreIndexes(store: IDBObjectStore) {
    store.createIndex('by_user', 'userId', { unique: false });
    store.createIndex('by_user_updated_at', ['userId', 'updatedAt'], { unique: false });
    store.createIndex('by_user_deleted_at', ['userId', 'deletedAt'], { unique: false });
    store.createIndex('by_user_folder', ['userId', 'folderId'], { unique: false });
}

export async function openNotesDb(): Promise<IDBDatabase> {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB is unavailable in this environment');
    }

    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                const transaction = request.transaction;
                const hadNotesStore = db.objectStoreNames.contains(NOTES_STORE);
                const needsSummaryBackfill = !db.objectStoreNames.contains(NOTE_SUMMARIES_STORE);

                if (!db.objectStoreNames.contains(NOTES_STORE)) {
                    const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
                    createStoreIndexes(notesStore);
                }

                if (!db.objectStoreNames.contains(NOTE_SUMMARIES_STORE)) {
                    const summariesStore = db.createObjectStore(NOTE_SUMMARIES_STORE, { keyPath: 'id' });
                    createSummaryStoreIndexes(summariesStore);
                }

                if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
                    const mutationsStore = db.createObjectStore(MUTATIONS_STORE, { keyPath: 'id' });
                    mutationsStore.createIndex('by_user', 'userId', { unique: false });
                    mutationsStore.createIndex('by_user_status', ['userId', 'status'], { unique: false });
                    mutationsStore.createIndex('by_note', 'noteId', { unique: false });
                    mutationsStore.createIndex('by_created_at', 'createdAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(META_STORE)) {
                    db.createObjectStore(META_STORE, { keyPath: 'key' });
                }

                if (needsSummaryBackfill && hadNotesStore && transaction) {
                    const notesStore = transaction.objectStore(NOTES_STORE);
                    const summariesStore = transaction.objectStore(NOTE_SUMMARIES_STORE);
                    const existingNotesRequest = notesStore.getAll();

                    existingNotesRequest.onsuccess = () => {
                        const existingNotes = existingNotesRequest.result as LocalNoteRecord[];
                        for (const note of existingNotes) {
                            summariesStore.put(toLocalNoteSummaryRecord(note, note.userId));
                        }
                    };
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
        });
    }

    return dbPromise;
}

export async function withTransaction<T>(
    storeNames: Array<keyof NotesDbSchema>,
    mode: IDBTransactionMode,
    fn: (stores: { [K in keyof NotesDbSchema]?: IDBObjectStore }) => Promise<T>,
): Promise<T> {
    const db = await openNotesDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeNames, mode);
        const stores: { [K in keyof NotesDbSchema]?: IDBObjectStore } = {};
        let result: T | undefined;
        let fnResolved = false;

        for (const storeName of storeNames) {
            stores[storeName] = tx.objectStore(storeName);
        }

        tx.oncomplete = () => {
            if (fnResolved) {
                resolve(result as T);
            }
        };
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));

        void fn(stores)
            .then((value) => {
                result = value;
                fnResolved = true;
            })
            .catch((error) => {
                tx.abort();
                reject(error);
            });
    });
}

export async function getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
    return promisifyRequest(store.getAll() as IDBRequest<T[]>);
}

export async function getByKey<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | undefined> {
    const result = await promisifyRequest(store.get(key) as IDBRequest<T | undefined>);
    return result;
}

export async function putValue(store: IDBObjectStore, value: unknown): Promise<void> {
    await promisifyRequest(store.put(value));
}

export async function deleteValue(store: IDBObjectStore, key: IDBValidKey): Promise<void> {
    await promisifyRequest(store.delete(key));
}

export async function readAllFromIndex<T>(store: IDBObjectStore, indexName: string, keyRange?: IDBKeyRange, direction: IDBCursorDirection = 'next'): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const items: T[] = [];
        const request = store.index(indexName).openCursor(keyRange, direction);

        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
                resolve(items);
                return;
            }

            items.push(cursor.value as T);
            cursor.continue();
        };

        request.onerror = () => reject(request.error ?? new Error('IndexedDB cursor read failed'));
    });
}

export function toLocalNoteRecord(note: Note, userId: string): LocalNoteRecord {
    const updatedAt = note.updatedAt ?? note.createdAt;

    return {
        ...note,
        userId,
        syncState: 'synced',
        localUpdatedAt: updatedAt,
        serverUpdatedAt: updatedAt,
        syncError: null,
    };
}

export function toLocalNoteSummaryRecord(note: Note, userId: string): LocalNoteSummaryRecord {
    const updatedAt = note.updatedAt ?? note.createdAt;
    const contentText = typeof note.contentText === 'string' ? note.contentText : '';

    return {
        id: note.id,
        userId,
        title: note.title,
        snippet: buildNoteSnippet(note.content, contentText),
        previewImage: extractFirstImage(note.content),
        contentText,
        tags: note.tags ?? [],
        folderId: note.folderId ?? null,
        folder: note.folder ?? null,
        createdAt: note.createdAt,
        updatedAt,
        deletedAt: note.deletedAt ?? null,
        syncState: note.syncState ?? 'synced',
        syncError: note.syncError ?? null,
        normalizedTitle: note.title.trim().toLowerCase(),
        normalizedContentText: contentText.trim().toLowerCase(),
    };
}

export function filterNoteTags(noteTags: NoteTag[] | undefined, tagFilter?: string): boolean {
    if (!tagFilter) {
        return true;
    }

    const normalizedFilter = tagFilter.trim().toLowerCase();
    return (noteTags ?? []).some((tag) => tag.id === tagFilter || tag.name.toLowerCase() === normalizedFilter);
}

export function filterNoteFolder(note: Pick<Note, 'folderId' | 'folder'>, folderFilter?: string): boolean {
    if (!folderFilter) {
        return true;
    }

    return note.folderId === folderFilter || note.folder?.name === folderFilter;
}

export function sortByUpdatedAtDesc<T extends Pick<Note, 'updatedAt' | 'createdAt'>>(notes: T[]): T[] {
    return [...notes].sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.createdAt).getTime();
        const bTime = new Date(b.updatedAt ?? b.createdAt).getTime();
        return bTime - aTime;
    });
}

export function deriveContentText(note: Note): string {
    if (typeof note.contentText === 'string' && note.contentText.trim()) {
        return note.contentText;
    }

    return JSON.stringify(note.content ?? '');
}
