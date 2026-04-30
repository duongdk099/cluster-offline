import type { JSONContent } from '@tiptap/core';

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
}
