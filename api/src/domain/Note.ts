// Notes Application Interfaces and Types
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
    [key: string]: JsonValue;
}

export interface NoteTag {
    id: string;
    name: string;
    color?: string | null;
}

export interface NoteFolder {
    id: string;
    name: string;
    color?: string | null;
}

export interface Note {
    id: string;
    userId: string;
    title: string;
    content: JsonValue;
    contentText: string;
    tags?: NoteTag[];
    folderId?: string | null;
    folder?: NoteFolder | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
}

export interface INoteRepository {
    save(note: Note): Promise<void>;
    findById(id: string, userId: string): Promise<Note | null>;
    findAll(userId: string): Promise<Note[]>;
    findDeleted(userId: string): Promise<Note[]>;
    update(id: string, userId: string, note: Partial<Note>): Promise<void>;
    restore(id: string, userId: string): Promise<void>;
    delete(id: string, userId: string): Promise<void>;
    permanentDelete(id: string, userId: string): Promise<void>;
    search(userId: string, query: string): Promise<Note[]>;
    listTags(userId: string): Promise<NoteTag[]>;
    addTagToNote(noteId: string, userId: string, tagName: string): Promise<NoteTag>;
    removeTagFromNote(noteId: string, userId: string, tagId: string): Promise<void>;
    findByTag(userId: string, tagNameOrId: string): Promise<Note[]>;
    listFolders(userId: string): Promise<NoteFolder[]>;
    createFolder(userId: string, name: string): Promise<NoteFolder>;
    assignFolderToNote(noteId: string, userId: string, folderId: string | null): Promise<void>;
    findByFolder(userId: string, folderId: string): Promise<Note[]>;
}
