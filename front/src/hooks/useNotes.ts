import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Note } from '../lib/types';
import type { JSONContent } from '@tiptap/core';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/notes` : 'http://localhost:3001/notes';

export function useNotes() {
    const { token } = useAuth();

    return useQuery<Note[]>({
        queryKey: ['notes'],
        queryFn: async () => {
            const res = await fetch(API_URL, {
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

export function useSearchNotes(query: string) {
    const { token } = useAuth();

    return useQuery<Note[]>({
        queryKey: ['notes', 'search', query],
        queryFn: async () => {
            const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            if (!res.ok) throw new Error('Failed to search notes');
            return res.json();
        },
        enabled: !!token && !!query.trim(),
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
        mutationFn: async (newNote: { title: string; content: JSONContent }) => {
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
        mutationFn: async ({ id, ...updates }: { id: string; title: string; content: JSONContent }) => {
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
