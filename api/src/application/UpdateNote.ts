import { Note, INoteRepository } from '../domain/Note';

export class UpdateNoteUseCase {
    constructor(private noteRepository: INoteRepository) { }

    async execute(id: string, userId: string, title?: string, content?: any): Promise<Note | null> {
        // Retry logic for race conditions with recent creates
        for (let attempt = 0; attempt < 5; attempt++) {
            const note = await this.noteRepository.findById(id, userId);
            if (note) {
                // Found the note, proceed with update
                const updatedNoteData: Partial<Note> = {};
                if (title !== undefined) updatedNoteData.title = title;
                if (content !== undefined) updatedNoteData.content = content;

                await this.noteRepository.update(id, userId, updatedNoteData);

                // Return fresh data from database
                return await this.noteRepository.findById(id, userId);
            }
            
            // Note not found, wait and retry
            await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        }
        
        return null;
    }
}
