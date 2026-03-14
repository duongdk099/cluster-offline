// Notes Application Interfaces and Types
export interface Note {
    id: string;
    userId: string;
    title: string;
    content: any;
    createdAt: Date;
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
}
