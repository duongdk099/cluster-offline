import type { JSONContent } from '@tiptap/core';
import type { Note } from '../types';
import type { NoteFilters } from './localNotesRepository';

const API_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/notes` : 'http://localhost:3001/notes';

function withAuth(token: string) {
    return {
        Authorization: `Bearer ${token}`,
    };
}

export interface NoteMutationPayload {
    id?: string;
    title: string;
    content: JSONContent;
    tags?: string[];
    folderId?: string | null;
}

function buildUrl(baseUrl: string, filters?: NoteFilters) {
    const params = new URLSearchParams();
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.folder) params.set('folder', filters.folder);
    const query = params.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
}

async function parseJsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
    if (!res.ok) {
        throw new Error(fallback);
    }

    return res.json() as Promise<T>;
}

export class RemoteNotesRepository {
    async getNotes(token: string, filters?: NoteFilters): Promise<Note[]> {
        const res = await fetch(buildUrl(API_URL, filters), {
            headers: withAuth(token),
        });

        return parseJsonOrThrow<Note[]>(res, 'Failed to fetch notes');
    }

    async searchNotes(token: string, query: string, filters?: NoteFilters): Promise<Note[]> {
        const params = new URLSearchParams({ q: query.trim() });
        if (filters?.tag) params.set('tag', filters.tag);
        if (filters?.folder) params.set('folder', filters.folder);

        const res = await fetch(`${API_URL}/search?${params.toString()}`, {
            headers: withAuth(token),
        });

        return parseJsonOrThrow<Note[]>(res, 'Failed to search notes');
    }

    async getDeletedNotes(token: string): Promise<Note[]> {
        const res = await fetch(`${API_URL}/deleted`, {
            headers: withAuth(token),
        });

        return parseJsonOrThrow<Note[]>(res, 'Failed to fetch deleted notes');
    }

    async getNoteById(token: string, id: string): Promise<Note> {
        const res = await fetch(`${API_URL}/${id}`, {
            headers: withAuth(token),
        });

        return parseJsonOrThrow<Note>(res, 'Failed to fetch note');
    }

    async createNote(token: string, note: NoteMutationPayload): Promise<Note> {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...withAuth(token),
            },
            body: JSON.stringify(note),
        });

        return parseJsonOrThrow<Note>(res, 'Failed to create note');
    }

    async updateNote(token: string, id: string, updates: Partial<NoteMutationPayload>): Promise<Note> {
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...withAuth(token),
            },
            body: JSON.stringify(updates),
        });

        return parseJsonOrThrow<Note>(res, 'Failed to update note');
    }

    async deleteNote(token: string, id: string): Promise<void> {
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: withAuth(token),
        });

        if (!res.ok) {
            throw new Error('Failed to delete note');
        }
    }

    async restoreNote(token: string, id: string): Promise<void> {
        const res = await fetch(`${API_URL}/${id}/restore`, {
            method: 'POST',
            headers: withAuth(token),
        });

        if (!res.ok) {
            throw new Error('Failed to restore note');
        }
    }

    async permanentDeleteNote(token: string, id: string): Promise<void> {
        const res = await fetch(`${API_URL}/${id}/permanent`, {
            method: 'DELETE',
            headers: withAuth(token),
        });

        if (!res.ok) {
            throw new Error('Failed to permanently delete note');
        }
    }
}

export const remoteNotesRepository = new RemoteNotesRepository();
