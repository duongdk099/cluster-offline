import { Note, INoteRepository } from '../domain/Note';

export class InMemoryNoteRepository implements INoteRepository {
    private notes: Map<string, Note> = new Map();

    async save(note: Note): Promise<void> {
        this.notes.set(note.id, note);
    }

    async findById(id: string, userId: string): Promise<Note | null> {
        const note = this.notes.get(id);
        return note && note.userId === userId ? note : null;
    }

    async findAll(userId: string): Promise<Note[]> {
        return Array.from(this.notes.values()).filter(n => n.userId === userId);
    }

    async update(id: string, userId: string, noteData: Partial<Note>): Promise<void> {
        const note = this.notes.get(id);
        if (note && note.userId === userId) {
            this.notes.set(id, { ...note, ...noteData });
        }
    }

    async delete(id: string, userId: string): Promise<void> {
        const note = this.notes.get(id);
        if (note && note.userId === userId) {
            this.notes.delete(id);
        }
    }
}
