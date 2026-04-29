import { Note } from '../domain/Note';
import { CreateNoteUseCase } from './CreateNote';
import { docxToNoteContent } from './import/docxToNoteContent';
import { markdownToNoteContent } from './import/markdownToNoteContent';
import { textToNoteContent } from './import/textToNoteContent';

export type ImportableNoteFile = {
    name: string;
    type?: string;
    bytes: ArrayBuffer;
};

export type ImportNoteInput = {
    userId: string;
    file: ImportableNoteFile;
    tags?: string[];
    folderId?: string | null;
};

const SUPPORTED_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'docx']);

function extensionFromFilename(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() ?? '';
}

function titleFromFilename(filename: string): string {
    const withoutExtension = filename.replace(/\.[^.]+$/, '');
    const title = withoutExtension
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return title || 'Imported Note';
}

function decodeText(bytes: ArrayBuffer): string {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export class ImportNoteUseCase {
    constructor(private createNoteUseCase: CreateNoteUseCase) {}

    async execute(input: ImportNoteInput): Promise<Note> {
        const extension = extensionFromFilename(input.file.name);
        if (!SUPPORTED_EXTENSIONS.has(extension)) {
            throw new Error('Unsupported import format');
        }

        const title = titleFromFilename(input.file.name);
        const content = extension === 'docx'
            ? await docxToNoteContent(input.file.bytes)
            : extension === 'md' || extension === 'markdown'
                ? markdownToNoteContent(decodeText(input.file.bytes))
                : textToNoteContent(decodeText(input.file.bytes));

        return this.createNoteUseCase.execute(
            input.userId,
            title,
            content,
            input.tags,
            input.folderId,
        );
    }
}

