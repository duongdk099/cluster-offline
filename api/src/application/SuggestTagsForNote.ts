import { INoteRepository } from '../domain/Note';
import { extractNoteText } from './extractNoteText';
import { deepseekChat } from '../infrastructure/DeepSeekClient';

const MAX_INPUT_CHARS = 8000;
const MAX_TAGS = 7;
const MAX_TAG_LENGTH = 60;

export class SuggestTagsForNoteUseCase {
    constructor(private noteRepository: INoteRepository) {}

    async execute(noteId: string, userId: string): Promise<{ tags: string[] } | null> {
        const note = await this.noteRepository.findById(noteId, userId);
        if (!note) {
            return null;
        }

        const rawText = extractNoteText(note.content);
        const text = rawText.length > MAX_INPUT_CHARS
            ? rawText.slice(0, MAX_INPUT_CHARS)
            : rawText;

        const existingTags = await this.noteRepository.listTags(userId);
        const existingTagNames = existingTags.map((t) => t.name);

        const systemPrompt = [
            'You are an expert at tagging personal notes.',
            'Return STRICT JSON in the exact form: {"tags": ["lowercase-kebab-tag", ...]}.',
            'Provide between 3 and 7 tags.',
            'Each tag must be lowercase-kebab-case (words joined with single hyphens), no spaces, no emojis, no punctuation other than hyphens.',
            'Prefer reusing tags from the user\'s existing tag list when they are topically aligned with the note.',
            'Only invent new tags when none of the existing tags fit.',
            'Keep tags short (1-3 words each).',
            `User's existing tags: ${existingTagNames.length > 0 ? JSON.stringify(existingTagNames) : '[]'}.`,
        ].join(' ');

        let raw: string;
        try {
            raw = await deepseekChat({
                jsonMode: true,
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: `Title: ${note.title || 'Untitled'}\n\nContent:\n${text}`,
                    },
                ],
            });
        } catch {
            return { tags: [] };
        }

        try {
            const parsed: unknown = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return { tags: [] };
            }
            const tagsField = (parsed as { tags?: unknown }).tags;
            if (!Array.isArray(tagsField)) {
                return { tags: [] };
            }

            const validated: string[] = [];
            for (const item of tagsField) {
                if (typeof item !== 'string') {
                    return { tags: [] };
                }
                const trimmed = item.trim();
                if (trimmed.length === 0 || trimmed.length > MAX_TAG_LENGTH) {
                    return { tags: [] };
                }
                validated.push(trimmed);
            }

            if (validated.length > MAX_TAGS) {
                return { tags: [] };
            }

            return { tags: validated };
        } catch {
            return { tags: [] };
        }
    }
}
