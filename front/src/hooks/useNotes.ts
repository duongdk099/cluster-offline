import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NoteTag, NoteFolder, NoteSummary } from '../lib/types';
import type { JSONContent } from '@tiptap/core';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import { getUserIdFromToken } from '../lib/auth';
import { notesService } from '../lib/notes/notesService';
import { NOTES_CHANGED_EVENT, type NoteFilters } from '../lib/notes/localNotesRepository';

const API_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/notes` : 'http://localhost:3001/notes';

export function useNotes(filters?: NoteFilters) {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);
    const queryClient = useQueryClient();
    const filtersKey = JSON.stringify(filters ?? {});

    useEffect(() => {
        const onNotesChanged = () => {
            void queryClient.invalidateQueries({ queryKey: ['notes', userId ?? '', filters?.tag || '', filters?.folder || ''] });
        };

        window.addEventListener(NOTES_CHANGED_EVENT, onNotesChanged);
        return () => window.removeEventListener(NOTES_CHANGED_EVENT, onNotesChanged);
    }, [filters?.folder, filters?.tag, filtersKey, queryClient, userId]);

    useEffect(() => {
        if (!token || !userId) {
            return;
        }

        void notesService.refreshNotes(userId, token, filters).catch(() => undefined);
    }, [filters, filtersKey, token, userId]);

    return useQuery<NoteSummary[]>({
        queryKey: ['notes', userId ?? '', filters?.tag || '', filters?.folder || ''],
        queryFn: async () => {
            if (!userId) {
                return [];
            }

            const localNotes = await notesService.listLocalNoteSummaries(userId, filters);
            if (localNotes.length > 0 || !token) {
                return localNotes;
            }

            return notesService.refreshNotes(userId, token, filters, true);
        },
        enabled: !!userId,
    });
}

export function useTags() {
    const { token } = useAuth();

    return useQuery<NoteTag[]>({
        queryKey: ['tags'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/tags`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok) throw new Error('Failed to fetch tags');
            return res.json();
        },
        enabled: !!token,
    });
}

export function useFolders() {
    const { token } = useAuth();

    return useQuery<NoteFolder[]>({
        queryKey: ['folders'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/folders`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok) throw new Error('Failed to fetch folders');
            return res.json();
        },
        enabled: !!token,
    });
}

export function useSearchNotes(query: string, filters?: NoteFilters) {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);
    const queryClient = useQueryClient();
    const normalizedQuery = query.trim();
    const filtersKey = JSON.stringify(filters ?? {});

    useEffect(() => {
        if (!token || !userId || normalizedQuery.length === 0) {
            return;
        }

        void notesService.refreshSearch(userId, token, normalizedQuery, filters).catch(() => undefined);
    }, [filters, filtersKey, normalizedQuery, token, userId]);

    useEffect(() => {
        const onNotesChanged = () => {
            void queryClient.invalidateQueries({ queryKey: ['notes', 'search', userId ?? '', normalizedQuery, filters?.tag || '', filters?.folder || ''] });
        };

        window.addEventListener(NOTES_CHANGED_EVENT, onNotesChanged);
        return () => window.removeEventListener(NOTES_CHANGED_EVENT, onNotesChanged);
    }, [filters?.folder, filters?.tag, filtersKey, normalizedQuery, queryClient, userId]);

    return useQuery<NoteSummary[]>({
        queryKey: ['notes', 'search', userId ?? '', normalizedQuery, filters?.tag || '', filters?.folder || ''],
        queryFn: async () => {
            if (!userId) {
                return [];
            }

            const localResults = await notesService.searchLocalNoteSummaries(userId, normalizedQuery, filters);
            if (localResults.length > 0 || !token) {
                return localResults;
            }

            return notesService.refreshSearch(userId, token, normalizedQuery, filters, true);
        },
        enabled: !!userId && normalizedQuery.length > 0,
    });
}

export function useDeletedNotes() {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);
    const queryClient = useQueryClient();

    useEffect(() => {
        const onNotesChanged = () => {
            void queryClient.invalidateQueries({ queryKey: ['notes', 'deleted', userId ?? ''] });
        };

        window.addEventListener(NOTES_CHANGED_EVENT, onNotesChanged);
        return () => window.removeEventListener(NOTES_CHANGED_EVENT, onNotesChanged);
    }, [queryClient, userId]);

    useEffect(() => {
        if (!token || !userId) {
            return;
        }

        void notesService.refreshDeletedNotes(userId, token).catch(() => undefined);
    }, [token, userId]);

    return useQuery<NoteSummary[]>({
        queryKey: ['notes', 'deleted', userId ?? ''],
        queryFn: async () => {
            if (!userId) {
                return [];
            }

            const localDeleted = await notesService.listLocalDeletedNoteSummaries(userId);
            if (localDeleted.length > 0 || !token) {
                return localDeleted;
            }

            return notesService.refreshDeletedNotes(userId, token, true);
        },
        enabled: !!userId,
    });
}

export function useCreateNote() {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);

    return useMutation({
        mutationFn: async (newNote: { title: string; content: JSONContent; tags?: string[]; folderId?: string | null }) => {
            if (!userId) {
                throw new Error('No authenticated user');
            }

            return notesService.createNoteLocally(userId, newNote);
        },
    });
}

export function useUpdateNote() {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);

    return useMutation({
        mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: JSONContent; tags?: string[]; folderId?: string | null }) => {
            if (!userId) {
                throw new Error('No authenticated user');
            }

            return notesService.updateNoteLocally(userId, id, updates);
        },
    });
}

export function useDeleteNote() {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);

    return useMutation({
        mutationFn: async (id: string) => {
            if (!userId) {
                throw new Error('No authenticated user');
            }

            await notesService.deleteNoteLocally(userId, id);
            return { id };
        },
    });
}

export function useRestoreNote() {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);

    return useMutation({
        mutationFn: async (id: string) => {
            if (!userId) {
                throw new Error('No authenticated user');
            }

            await notesService.restoreNoteLocally(userId, id);
            return { id };
        },
    });
}

export function usePermanentDeleteNote() {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);

    return useMutation({
        mutationFn: async (id: string) => {
            if (!userId) {
                throw new Error('No authenticated user');
            }

            await notesService.permanentDeleteNoteLocally(userId, id);
            return { id };
        },
    });
}

export function useAddTagToNote() {
    const queryClient = useQueryClient();
    const { token } = useAuth();

    return useMutation({
        mutationFn: async ({ id, name }: { id: string; name: string }) => {
            const res = await fetch(`${API_URL}/${id}/tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ name }),
            });

            if (!res.ok) throw new Error('Failed to add tag');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
    });
}

export function useCreateFolder() {
    const queryClient = useQueryClient();
    const { token } = useAuth();

    return useMutation({
        mutationFn: async ({ name }: { name: string }) => {
            const res = await fetch(`${API_URL}/folders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ name }),
            });

            if (!res.ok) throw new Error('Failed to create folder');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            queryClient.invalidateQueries({ queryKey: ['notes'] });
        },
    });
}

export function useAssignFolderToNote() {
    const queryClient = useQueryClient();
    const { token } = useAuth();

    return useMutation({
        mutationFn: async ({ id, folderId }: { id: string; folderId: string | null }) => {
            const res = await fetch(`${API_URL}/${id}/folder`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ folderId }),
            });

            if (!res.ok) throw new Error('Failed to assign folder');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['folders'] });
        },
    });
}

export function useRemoveTagFromNote() {
    const queryClient = useQueryClient();
    const { token } = useAuth();

    return useMutation({
        mutationFn: async ({ id, tagId }: { id: string; tagId: string }) => {
            const res = await fetch(`${API_URL}/${id}/tags/${tagId}`, {
                method: 'DELETE',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });

            if (!res.ok) throw new Error('Failed to remove tag');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
    });
}
