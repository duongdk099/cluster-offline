'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getUserIdFromToken } from '../lib/auth';
import { notesService } from '../lib/notes/notesService';
import { NOTES_CHANGED_EVENT } from '../lib/notes/localNotesRepository';
import type { Note } from '../lib/types';

export function useLocalFirstNote(id: string) {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);
    const queryClient = useQueryClient();

    useEffect(() => {
        const onNotesChanged = () => {
            void queryClient.invalidateQueries({ queryKey: ['note', userId ?? '', id] });
        };

        window.addEventListener(NOTES_CHANGED_EVENT, onNotesChanged);
        return () => window.removeEventListener(NOTES_CHANGED_EVENT, onNotesChanged);
    }, [id, queryClient, userId]);

    useEffect(() => {
        if (!token || !userId) {
            return;
        }

        void notesService.getNoteById(userId, token, id).catch(() => undefined);
    }, [id, token, userId]);

    return useQuery<Note | null>({
        queryKey: ['note', userId ?? '', id],
        queryFn: async () => {
            if (!userId) {
                return null;
            }

            return notesService.getLocalNoteById(userId, id);
        },
        enabled: !!userId,
    });
}
