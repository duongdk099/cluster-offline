import { Note, INoteRepository } from '../domain/Note';
import { randomUUID } from 'crypto';

export class CreateNoteUseCase {
    constructor(private noteRepository: INoteRepository) { }

    async execute(userId: string, title: string, content: any): Promise<Note> {
        const note: Note = {
            id: randomUUID(),
            userId,
            title,
            content,
            createdAt: new Date(),
        };
        await this.noteRepository.save(note);
        return note;
    }
}
