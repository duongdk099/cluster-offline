import { EventEmitter } from 'events';

export const wsEvents = new EventEmitter();

/**
 * Common event types
 */
export type WSEvent = {
    type: 'NOTE_CREATED' | 'NOTE_UPDATED' | 'NOTE_DELETED';
    userId: string;
    noteId?: string;
};

/**
 * Utility to notify the websocket layer from the HTTP layer
 */
export const notifyChange = (userId: string, type: WSEvent['type'], noteId?: string) => {
    wsEvents.emit('broadcast', { userId, type, noteId });
};
