import { INoteRepository, Note } from '../domain/Note';
import { noteContentToMarkdown } from './export/noteToMarkdown';
import { noteToDocxBuffer } from './export/noteToDocx';
import { noteToPdfBuffer } from './export/noteToPdf';

export type ExportFormat = 'md' | 'markdown' | 'pdf' | 'docx';

export type ExportedNote = {
    body: string | Buffer;
    filename: string;
    contentType: string;
};

function sanitizeFilename(name: string, extension: string): string {
    const base = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

    return `${base || 'untitled-note'}.${extension}`;
}

function noteToMarkdownFile(note: Note): string {
    const content = noteContentToMarkdown(note.content);
    const title = note.title.trim() || 'Untitled';
    const tags = (note.tags ?? []).map((tag) => tag.name).join(', ');
    const metadata = [
        `# ${title}`,
        '',
        `Updated: ${note.updatedAt.toISOString()}`,
        tags ? `Tags: ${tags}` : '',
        note.folder?.name ? `Folder: ${note.folder.name}` : '',
    ].filter(Boolean);

    return [...metadata, '', content].join('\n').trimEnd() + '\n';
}

export class ExportNoteUseCase {
    constructor(private noteRepository: INoteRepository) {}

    async execute(id: string, userId: string, format: ExportFormat): Promise<ExportedNote | null> {
        const note = await this.noteRepository.findById(id, userId);
        if (!note) {
            return null;
        }

        if (format === 'md' || format === 'markdown') {
            return {
                body: noteToMarkdownFile(note),
                filename: sanitizeFilename(note.title, 'md'),
                contentType: 'text/markdown; charset=utf-8',
            };
        }

        if (format === 'docx') {
            return {
                body: await noteToDocxBuffer(note),
                filename: sanitizeFilename(note.title, 'docx'),
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            };
        }

        return {
            body: await noteToPdfBuffer(note),
            filename: sanitizeFilename(note.title, 'pdf'),
            contentType: 'application/pdf',
        };
    }
}

