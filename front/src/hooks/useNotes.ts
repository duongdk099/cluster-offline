import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Note, NoteTag, NoteFolder } from '../lib/types';
import type { JSONContent } from '@tiptap/core';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/notes` : 'http://localhost:3001/notes';

type NoteFilters = {
    tag?: string;
    folder?: string;
};

export function useNotes(filters?: NoteFilters) {
    const { token } = useAuth();
    const params = new URLSearchParams();
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.folder) params.set('folder', filters.folder);
    const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL;

    return useQuery<Note[]>({
        queryKey: ['notes', filters?.tag || '', filters?.folder || ''],
        queryFn: async () => {
            const res = await fetch(url, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error('Failed to fetch notes');
            return res.json();
        },
        enabled: !!token,
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
    const normalizedQuery = query.trim();
    const params = new URLSearchParams({ q: normalizedQuery });
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.folder) params.set('folder', filters.folder);

    return useQuery<Note[]>({
        queryKey: ['notes', 'search', normalizedQuery, filters?.tag || '', filters?.folder || ''],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/search?${params.toString()}`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error('Failed to search notes');
            return res.json();
        },
        enabled: !!token && normalizedQuery.length > 0,
    });
}

export function useDeletedNotes() {
    const { token } = useAuth();

    return useQuery<Note[]>({
        queryKey: ['notes', 'deleted'],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/deleted`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error('Failed to fetch deleted notes');
            return res.json();
        },
        enabled: !!token,
    });
}

export function useCreateNote() {
    const queryClient = useQueryClient();
    const { token } = useAuth();

    return useMutation({
        mutationFn: async (newNote: { title: string; content: JSONContent; tags?: string[]; folderId?: string | null }) => {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(newNote),
            });
            if (!res.ok) throw new Error('Failed to create note');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
        },
    });
}

export function useUpdateNote() {
    const queryClient = useQueryClient();
    const { token } = useAuth();

    return useMutation({
        mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: JSONContent; tags?: string[]; folderId?: string | null }) => {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(updates),
            });

            // Parse body once — res.text()/res.json() can only be called once per response
            const text = await res.text();
            if (!res.ok) {
                console.error('Update note error:', {
                    status: res.status,
                    statusText: res.statusText,
                    body: text,
                    noteId: id,
                });
                throw new Error(`Failed to update note (${res.status}): ${text}`);
            }
            return JSON.parse(text);
        },
        onSuccess: (updatedNote) => {
            // Surgically update the note in the cache — no extra network request needed
            queryClient.setQueryData<Note[]>(['notes'], (old) =>
                old ? old.map((n) => (n.id === updatedNote.id ? updatedNote : n)) : old
            );
            // Also update individual note cache if present
            queryClient.setQueryData(['note', updatedNote.id], updatedNote);
        },
        onError: () => {
            // On failure, invalidate so the list re-fetches to restore consistency
            queryClient.invalidateQueries({ queryKey: ['notes'] });
        },
    });
}

export function useDeleteNote() {
    const queryClient = useQueryClient();
    const { token } = useAuth();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error('Failed to delete note');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
        },
    });
}

export function useRestoreNote() {
    const queryClient = useQueryClient();
    const { token } = useAuth();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_URL}/${id}/restore`, {
                method: 'POST',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error('Failed to restore note');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['notes', 'deleted'] });
        },
    });
}

export function usePermanentDeleteNote() {
    const queryClient = useQueryClient();
    const { token } = useAuth();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_URL}/${id}/permanent`, {
                method: 'DELETE',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error('Failed to permanently delete note');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['notes', 'deleted'] });
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
