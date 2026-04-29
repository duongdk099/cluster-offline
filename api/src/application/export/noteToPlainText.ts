import { extractNoteText } from '../extractNoteText';

export function noteContentToPlainText(content: unknown): string {
    return extractNoteText(content);
}

