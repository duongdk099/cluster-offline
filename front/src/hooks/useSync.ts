import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserIdFromToken } from '../lib/auth';
import { notesService } from '../lib/notes/notesService';
import { NOTES_OUTBOX_EVENT } from '../lib/notes/localNotesRepository';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export function useSync() {
    const { token } = useAuth();
    const userId = getUserIdFromToken(token);
    const socketRef = useRef<WebSocket | null>(null);
    const syncInFlightRef = useRef(false);

    useEffect(() => {
        if (!token || !userId) {
            return;
        }

        let cancelled = false;

        const runSync = async () => {
            if (cancelled || syncInFlightRef.current) {
                return;
            }

            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return;
            }

            syncInFlightRef.current = true;
            try {
                await notesService.flushOutbox(userId, token);
            } finally {
                syncInFlightRef.current = false;
            }
        };

        const handleOutboxChanged = () => {
            void runSync();
        };

        const interval = window.setInterval(() => {
            void runSync();
        }, 3000);

        window.addEventListener('online', handleOutboxChanged);
        window.addEventListener(NOTES_OUTBOX_EVENT, handleOutboxChanged);
        void runSync();

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            window.removeEventListener('online', handleOutboxChanged);
            window.removeEventListener(NOTES_OUTBOX_EVENT, handleOutboxChanged);
        };
    }, [token, userId]);

    useEffect(() => {
        if (!token || !userId) {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            return;
        }

        let active = true; // prevent reconnect after cleanup
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let attempt = 0;

        const connect = () => {
            if (!active) return;

            const socket = new WebSocket(`${WS_URL}?token=${token}`);
            socketRef.current = socket;

            socket.onopen = () => {
                attempt = 0; // reset backoff on successful connect
            };

            socket.onmessage = (event) => {
                void (async () => {
                    try {
                    const data = JSON.parse(event.data);
                    await notesService.applyRemoteNoteEvent(userId, token, data.type, data.noteId);
                    } catch (err) {
                        console.error('[WS] Failed to process message:', err);
                    }
                })();
            };

            socket.onclose = () => {
                socketRef.current = null;
                if (!active) return;
                // Exponential backoff: 1s, 2s, 4s, 8s … max 30s
                const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                attempt++;
                reconnectTimer = setTimeout(connect, delay);
            };

            socket.onerror = () => {
                // onclose always fires after onerror — reconnect is handled there
            };
        };

        connect();

        return () => {
            active = false;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [token, userId]);
}
