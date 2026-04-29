import mammoth from 'mammoth';
import { JsonValue } from '../../domain/Note';
import { textToNoteContent } from './textToNoteContent';

export async function docxToNoteContent(bytes: ArrayBuffer): Promise<JsonValue> {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return textToNoteContent(result.value);
}

