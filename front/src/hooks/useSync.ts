import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export function useSync() {
    const { token } = useAuth();
    const queryClient = useQueryClient();
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!token) {
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
                try {
                    const data = JSON.parse(event.data);
                    const noteMutatingEvents = ['NOTE_UPDATED', 'NOTE_CREATED', 'NOTE_DELETED', 'NOTE_RESTORED', 'NOTE_PERMANENTLY_DELETED'];
                    if (noteMutatingEvents.includes(data.type)) {
                        queryClient.invalidateQueries({ queryKey: ['notes'] });
                        if (data.noteId) {
                            queryClient.invalidateQueries({ queryKey: ['note', data.noteId] });
                        }
                    }
                } catch (err) {
                    console.error('[WS] Failed to parse message:', err);
                }
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
    }, [token, queryClient]);
}
