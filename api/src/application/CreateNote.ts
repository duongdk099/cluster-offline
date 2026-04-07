import { Note, INoteRepository, JsonValue } from '../domain/Note';
import { randomUUID } from 'crypto';
import { extractNoteText } from './extractNoteText';

export class CreateNoteUseCase {
    constructor(private noteRepository: INoteRepository) { }

    async execute(
        userId: string,
        title: string,
        content: JsonValue,
        tagNames?: string[],
        folderId?: string | null,
    ): Promise<Note> {
        const now = new Date();
        const note: Note = {
            id: randomUUID(),
            userId,
            title,
            content,
            contentText: extractNoteText(content),
            createdAt: now,
            updatedAt: now,
            tags: [],
            folderId,
        };
        await this.noteRepository.save(note);

        if (tagNames?.length) {
            for (const tagName of tagNames) {
                await this.noteRepository.addTagToNote(note.id, userId, tagName);
            }
        }

        const persistedNote = await this.noteRepository.findById(note.id, userId);
        if (!persistedNote) {
            throw new Error('Failed to load created note');
        }
        return persistedNote;
    }
}
