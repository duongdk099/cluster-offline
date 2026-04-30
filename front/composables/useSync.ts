import { useQueryClient } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';

export function useSync() {
  const auth = useAuthStore();
  const { token } = storeToRefs(auth);
  const queryClient = useQueryClient();
  const config = useRuntimeConfig();

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  let attempt = 0;
  let unwatch: (() => void) | null = null;

  const stop = () => {
    active = false;
    attempt = 0;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket) {
      socket.close();
      socket = null;
    }
  };

  const connect = () => {
    if (!active || !token.value) {
      if (socket) {
        socket.close();
        socket = null;
      }
      return;
    }

    socket = new WebSocket(`${config.public.wsUrl}?token=${token.value}`);

    socket.onopen = () => {
      attempt = 0;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const noteMutatingEvents = [
          'NOTE_UPDATED',
          'NOTE_CREATED',
          'NOTE_DELETED',
          'NOTE_RESTORED',
          'NOTE_PERMANENTLY_DELETED',
        ];

        if (noteMutatingEvents.includes(data.type)) {
          queryClient.invalidateQueries({ queryKey: ['notes'] });
          if (data.noteId) {
            queryClient.invalidateQueries({ queryKey: ['note', data.noteId] });
          }
        }
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    socket.onclose = () => {
      socket = null;
      if (!active) return;

      const delay = Math.min(1000 * 2 ** attempt, 30000);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      // Reconnect is handled by onclose.
    };
  };

  const start = () => {
    if (active) return;

    active = true;
    connect();

    unwatch = watch(token, () => {
      stop();
      active = true;
      connect();
    });
  };

  onScopeDispose(() => {
    unwatch?.();
    stop();
  });

  return { start, stop };
}
