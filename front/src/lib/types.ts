import { JSONContent } from '@tiptap/core';

export interface Note {
    id: string;
    title: string;
    content: JSONContent;
    createdAt: string;
    deletedAt?: string | null;
}
