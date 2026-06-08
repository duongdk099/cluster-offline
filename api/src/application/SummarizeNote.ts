import { INoteRepository } from '../domain/Note';
import { extractNoteText } from './extractNoteText';
import { deepseekChat } from '../infrastructure/DeepSeekClient';
import { config } from '../config';

export class SummarizeNoteUseCase {
    constructor(private noteRepository: INoteRepository) {}

    async execute(noteId: string, userId: string): Promise<{ summary: string } | null> {
        const note = await this.noteRepository.findById(noteId, userId);
        if (!note) {
            return null;
        }

        const rawText = extractNoteText(note.content);
        const text = rawText.length > config.rag.summaryMaxInputChars
            ? rawText.slice(0, config.rag.summaryMaxInputChars)
            : rawText;

        const summary = await deepseekChat({
            messages: [
                {
                    role: 'system',
                    content: 'You are a precise summarizer. Reply with 3-5 short sentences capturing the key points of the note. No preamble, no headings, just the summary.',
                },
                {
                    role: 'user',
                    content: `Title: ${note.title || 'Untitled'}\n\nContent:\n${text}`,
                },
            ],
        });

        return { summary: summary.trim() };
    }
}
