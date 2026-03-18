import { EventEmitter } from 'events';

export const wsEvents = new EventEmitter();

/**
 * Common event types
 */
export type NoteChangeType =
    | 'NOTE_CREATED'
    | 'NOTE_UPDATED'
    | 'NOTE_DELETED'
    | 'NOTE_RESTORED'
    | 'NOTE_PERMANENTLY_DELETED';

export type WSEvent = {
    type: NoteChangeType;
    userId: string;
    noteId?: string;
};

/**
 * Utility to notify the websocket layer from the HTTP layer
 */
export const notifyChange = (userId: string, type: NoteChangeType, noteId?: string) => {
    wsEvents.emit('broadcast', { userId, type, noteId });
};
