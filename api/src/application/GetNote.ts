import { Note, INoteRepository } from '../domain/Note';

export class GetNoteUseCase {
    constructor(private noteRepository: INoteRepository) { }

    async execute(id: string, userId: string): Promise<Note | null> {
        return await this.noteRepository.findById(id, userId);
    }
}
