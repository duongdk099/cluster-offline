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
    tags?: NoteTag[];
    folderId?: string | null;
    folder?: NoteFolder | null;
    createdAt: string;
    deletedAt?: string | null;
}
