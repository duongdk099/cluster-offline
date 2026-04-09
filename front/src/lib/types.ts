import { JSONContent } from '@tiptap/core';

export interface NoteTag {
    id: string;
    name: string;
    color?: string | null;
}

export interface NoteFolder {
    id: string;
    name: string;
    color?: string | null;
}

export interface Note {
    id: string;
    title: string;
    content: JSONContent;
    contentText?: string;
    tags?: NoteTag[];
    folderId?: string | null;
    folder?: NoteFolder | null;
    createdAt: string;
    updatedAt?: string;
    deletedAt?: string | null;
    syncState?: 'synced' | 'cached' | 'pending' | 'syncing' | 'failed' | 'conflict';
    syncError?: string | null;
}

export interface NoteSummary {
    id: string;
    title: string;
    snippet: string;
    previewImage: string | null;
    contentText?: string;
    tags?: NoteTag[];
    folderId?: string | null;
    folder?: NoteFolder | null;
    createdAt: string;
    updatedAt?: string;
    deletedAt?: string | null;
    syncState?: 'synced' | 'cached' | 'pending' | 'syncing' | 'failed' | 'conflict';
    syncError?: string | null;
}
