import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { randomUUID } from 'crypto';
import { CreateNoteUseCase } from '../application/CreateNote';
import { GetNoteUseCase } from '../application/GetNote';
import { UpdateNoteUseCase } from '../application/UpdateNote';
import { DeleteNoteUseCase } from '../application/DeleteNote';
import { ExportFormat, ExportNoteUseCase } from '../application/ExportNote';
import { ImportNoteUseCase } from '../application/ImportNote';
import { SummarizeNoteUseCase } from '../application/SummarizeNote';
import { SuggestTagsForNoteUseCase } from '../application/SuggestTagsForNote';
import { DetectActionsInNoteUseCase } from '../application/DetectActionsInNote';
import { ChunkAndEmbedNoteUseCase } from '../application/ChunkAndEmbedNote';
import { DrizzleNoteRepository } from '../infrastructure/DrizzleNoteRepository';
import { client } from '../infrastructure/db';
import { notifyChange } from '../infrastructure/websocket';
import { config } from '../config';

const noteRoutes = new Hono();
const IMPORTABLE_MIME_TYPES = new Set([
    'text/markdown',
    'text/x-markdown',
    'text/plain',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '',
]);
const IMPORTABLE_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'docx']);

function sanitizeTagNames(input: unknown): string[] | null | undefined {
    if (input === undefined) {
        return undefined;
    }

    if (!Array.isArray(input)) {
        return null;
    }

    const normalized = [...new Set(input
        .map((tag) => (typeof tag === 'string' ? tag.trim().replace(/\s+/g, ' ') : ''))
        .filter(Boolean)
        .map((tag) => tag.slice(0, config.maxTagLength)))];

    if (normalized.length > config.maxTagsPerNote) {
        return null;
    }

    return normalized;
}

function parseImportTags(input: unknown): string[] | null | undefined {
    if (input === undefined) {
        return undefined;
    }

    if (typeof input !== 'string') {
        return null;
    }

    const parsed = input
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

    return sanitizeTagNames(parsed);
}

function isImportableFile(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return IMPORTABLE_EXTENSIONS.has(extension) && IMPORTABLE_MIME_TYPES.has(file.type);
}

noteRoutes.use('*', jwt({ secret: config.jwtSecret, alg: 'HS256' }));

const noteRepository = new DrizzleNoteRepository();
const createNoteUseCase = new CreateNoteUseCase(noteRepository);
const getNoteUseCase = new GetNoteUseCase(noteRepository);
const updateNoteUseCase = new UpdateNoteUseCase(noteRepository);
const deleteNoteUseCase = new DeleteNoteUseCase(noteRepository);
const exportNoteUseCase = new ExportNoteUseCase(noteRepository);
const importNoteUseCase = new ImportNoteUseCase(createNoteUseCase);
const summarizeNoteUseCase = new SummarizeNoteUseCase(noteRepository);
const suggestTagsForNoteUseCase = new SuggestTagsForNoteUseCase(noteRepository);
const detectActionsInNoteUseCase = new DetectActionsInNoteUseCase(noteRepository);
const chunkAndEmbedUseCase = new ChunkAndEmbedNoteUseCase(noteRepository);

// Search notes
noteRoutes.get('/search', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const query = c.req.query('q') || '';
    const tag = c.req.query('tag') || '';
    const folder = c.req.query('folder') || '';
    
    if (!query.trim() && !tag.trim() && !folder.trim()) {
        // Return all notes if no search query and no filters
        const notes = await noteRepository.findAll(payload.sub);
        return c.json(notes);
    }

    if (!query.trim() && tag.trim() && !folder.trim()) {
        const notes = await noteRepository.findByTag(payload.sub, tag);
        return c.json(notes);
    }

    if (!query.trim() && folder.trim() && !tag.trim()) {
        const notes = await noteRepository.findByFolder(payload.sub, folder);
        return c.json(notes);
    }
    
    let notes = await noteRepository.search(payload.sub, query);
    if (tag.trim()) {
        const normalizedTag = tag.trim().toLowerCase();
        notes = notes.filter((note) =>
            (note.tags ?? []).some(
                (noteTag) =>
                    noteTag.id === tag || noteTag.name.toLowerCase() === normalizedTag,
            ),
        );
    }

    if (folder.trim()) {
        notes = notes.filter((note) => note.folderId === folder || note.folder?.name === folder);
    }

    return c.json(notes);
});

// List available tags for current user
noteRoutes.get('/tags', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const tags = await noteRepository.listTags(payload.sub);
    return c.json(tags);
});

// List available folders for current user
noteRoutes.get('/folders', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const folders = await noteRepository.listFolders(payload.sub);
    return c.json(folders);
});

// Create a folder
noteRoutes.post('/folders', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const body = await c.req.json();

    if (typeof body?.name !== 'string' || !body.name.trim()) {
        return c.json({ error: 'Folder name is required' }, 400);
    }

    const name = body.name.trim().slice(0, config.maxFolderLength);
    const folder = await noteRepository.createFolder(payload.sub, name);
    return c.json(folder, 201);
});

// Get deleted notes
noteRoutes.get('/deleted', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const notes = await noteRepository.findDeleted(payload.sub);
    return c.json(notes);
});

noteRoutes.post('/', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const body = await c.req.json();
    const tags = sanitizeTagNames(body.tags);
    const folderId = body.folderId === undefined || body.folderId === null
        ? null
        : (typeof body.folderId === 'string' ? body.folderId : undefined);

    if (tags === null) {
        return c.json({ error: 'Invalid tags format' }, 400);
    }
    if (folderId === undefined) {
        return c.json({ error: 'Invalid folderId format' }, 400);
    }

    const note = await createNoteUseCase.execute(payload.sub, body.title, body.content, tags, folderId);

    // Notify clients
    notifyChange(payload.sub, 'NOTE_CREATED', note.id);

    void chunkAndEmbedUseCase.execute(note.id, payload.sub).catch((err) => {
        console.error('[chunk+embed create]', err);
    });

    return c.json(note, 201);
});

noteRoutes.post('/import', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const body = await c.req.parseBody();
    const file = body.file;
    const tags = parseImportTags(body.tags);
    const folderId = body.folderId === undefined || body.folderId === null || body.folderId === ''
        ? null
        : (typeof body.folderId === 'string' ? body.folderId : undefined);

    if (!(file instanceof File)) {
        return c.json({ error: 'File is required' }, 400);
    }

    if (tags === null) {
        return c.json({ error: 'Invalid tags format' }, 400);
    }

    if (folderId === undefined) {
        return c.json({ error: 'Invalid folderId format' }, 400);
    }

    if (file.size > config.maxImportFileBytes) {
        return c.json({ error: 'File too large. Maximum size: 5MB' }, 400);
    }

    if (!isImportableFile(file)) {
        return c.json({ error: 'Unsupported import format. Use .md, .markdown, .txt, or .docx' }, 400);
    }

    try {
        const note = await importNoteUseCase.execute({
            userId: payload.sub,
            file: {
                name: file.name,
                type: file.type,
                bytes: await file.arrayBuffer(),
            },
            tags,
            folderId,
        });

        notifyChange(payload.sub, 'NOTE_CREATED', note.id);
        return c.json(note, 201);
    } catch {
        return c.json({ error: 'Failed to import note' }, 400);
    }
});

noteRoutes.get('/', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const tag = c.req.query('tag') || '';
    const folder = c.req.query('folder') || '';

    let notes = await noteRepository.findAll(payload.sub);
    if (tag.trim()) {
        notes = await noteRepository.findByTag(payload.sub, tag);
    }
    if (folder.trim()) {
        notes = notes.filter((note) => note.folderId === folder || note.folder?.name === folder);
    }

    return c.json(notes);
});

noteRoutes.get('/:id/export/:format', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const id = c.req.param('id');
    const format = c.req.param('format') as ExportFormat;
    const supportedFormats = new Set<ExportFormat>(['md', 'markdown', 'pdf', 'docx']);

    if (!supportedFormats.has(format)) {
        return c.json({ error: 'Unsupported export format' }, 400);
    }

    const exported = await exportNoteUseCase.execute(id, payload.sub, format);
    if (!exported) {
        return c.json({ error: 'Note not found' }, 404);
    }

    const body: BodyInit = typeof exported.body === 'string'
        ? exported.body
        : new Uint8Array(exported.body);

    return new Response(body, {
        headers: {
            'Content-Type': exported.contentType,
            'Content-Disposition': `attachment; filename="${exported.filename}"`,
            'Cache-Control': 'no-store',
        },
    });
});

noteRoutes.get('/:id', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const id = c.req.param('id');
    const note = await getNoteUseCase.execute(id, payload.sub);
    if (!note) {
        return c.json({ error: 'Note not found' }, 404);
    }
    return c.json(note);
});

noteRoutes.on(['PUT', 'PATCH'], '/:id', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const id = c.req.param('id');
    const body = await c.req.json();
    const tags = sanitizeTagNames(body.tags);
    const folderId = body.folderId === undefined
        ? undefined
        : (body.folderId === null ? null : (typeof body.folderId === 'string' ? body.folderId : undefined));

    if (tags === null) {
        return c.json({ error: 'Invalid tags format' }, 400);
    }
    if (folderId === undefined && body.folderId !== undefined) {
        return c.json({ error: 'Invalid folderId format' }, 400);
    }

    const note = await updateNoteUseCase.execute(id, payload.sub, body.title, body.content, tags, folderId);
    if (!note) {
        return c.json({ error: 'Note not found' }, 404);
    }

    // Notify clients
    notifyChange(payload.sub, 'NOTE_UPDATED', note.id);

    void chunkAndEmbedUseCase.execute(note.id, payload.sub).catch((err) => {
        console.error('[chunk+embed update]', err);
    });

    return c.json(note);
});

noteRoutes.delete('/:id', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const id = c.req.param('id');
    const success = await deleteNoteUseCase.execute(id, payload.sub);
    if (!success) {
        return c.json({ error: 'Note not found' }, 404);
    }

    // Notify clients
    notifyChange(payload.sub, 'NOTE_DELETED', id);

    return c.json({ message: 'Note moved to trash' });
});

// Add a tag to a note
noteRoutes.post('/:id/tags', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const id = c.req.param('id');
    const body = await c.req.json();

    if (typeof body?.name !== 'string' || !body.name.trim()) {
        return c.json({ error: 'Tag name is required' }, 400);
    }

    const tagName = body.name.trim().slice(0, config.maxTagLength);

    try {
        const tag = await noteRepository.addTagToNote(id, payload.sub, tagName);
        notifyChange(payload.sub, 'NOTE_UPDATED', id);
        return c.json(tag, 201);
    } catch {
        return c.json({ error: 'Note not found' }, 404);
    }
});

// Assign folder to note
noteRoutes.patch('/:id/folder', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const id = c.req.param('id');
    const body = await c.req.json();
    const folderId = body?.folderId === null
        ? null
        : (typeof body?.folderId === 'string' ? body.folderId : undefined);

    if (folderId === undefined) {
        return c.json({ error: 'Invalid folderId format' }, 400);
    }

    try {
        await noteRepository.assignFolderToNote(id, payload.sub, folderId);
        notifyChange(payload.sub, 'NOTE_UPDATED', id);
        return c.json({ message: 'Folder updated' });
    } catch {
        return c.json({ error: 'Note or folder not found' }, 404);
    }
});

// Remove a tag from a note
noteRoutes.delete('/:id/tags/:tagId', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const id = c.req.param('id');
    const tagId = c.req.param('tagId');

    try {
        await noteRepository.removeTagFromNote(id, payload.sub, tagId);
        notifyChange(payload.sub, 'NOTE_UPDATED', id);
        return c.json({ message: 'Tag removed' });
    } catch {
        return c.json({ error: 'Note not found' }, 404);
    }
});

// Restore deleted note
noteRoutes.post('/:id/restore', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const id = c.req.param('id');
    const success = await deleteNoteUseCase.executeRestore(id, payload.sub);
    if (!success) {
        return c.json({ error: 'Note not found' }, 404);
    }

    // Notify clients
    notifyChange(payload.sub, 'NOTE_RESTORED', id);

    return c.json({ message: 'Note restored' });
});

// Permanently delete note
noteRoutes.delete('/:id/permanent', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const id = c.req.param('id');
    const success = await deleteNoteUseCase.executePermanent(id, payload.sub);
    if (!success) {
        return c.json({ error: 'Note not found' }, 404);
    }

    // Notify clients
    notifyChange(payload.sub, 'NOTE_PERMANENTLY_DELETED', id);

    return c.json({ message: 'Note permanently deleted' });
});

noteRoutes.post('/:id/ai/summarize', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    try {
        const result = await summarizeNoteUseCase.execute(c.req.param('id'), payload.sub);
        if (!result) return c.json({ error: 'Note not found' }, 404);
        return c.json(result);
    } catch (e: unknown) {
        return c.json({ error: e instanceof Error ? e.message : 'Summarize failed' }, 500);
    }
});

noteRoutes.post('/:id/ai/auto-tag', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    try {
        const result = await suggestTagsForNoteUseCase.execute(c.req.param('id'), payload.sub);
        if (!result) return c.json({ error: 'Note not found' }, 404);
        return c.json(result);
    } catch (e: unknown) {
        return c.json({ error: e instanceof Error ? e.message : 'Auto-tag failed' }, 500);
    }
});

noteRoutes.post('/:id/ai/extract-actions', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    try {
        const result = await detectActionsInNoteUseCase.execute(c.req.param('id'), payload.sub);
        if (!result) return c.json({ error: 'Note not found' }, 404);
        return c.json(result);
    } catch (e: unknown) {
        return c.json({ error: e instanceof Error ? e.message : 'Extract actions failed' }, 500);
    }
});

noteRoutes.post('/:id/share', async (c) => {
  const payload = c.get('jwtPayload') as { sub: string };
  const noteId = c.req.param('id');

  // Verify the note exists and belongs to this user
  const note = await noteRepository.findById(noteId, payload.sub);
  if (!note) return c.json({ error: 'Note not found' }, 404);

  // Idempotent: return the existing token if one exists for this note
  const existing = await client`
    SELECT token FROM share_tokens WHERE note_id = ${noteId} LIMIT 1
  `;
  if (existing.length > 0) {
    return c.json({ token: existing[0].token as string });
  }

  const id = randomUUID();
  const token = (randomUUID() + randomUUID()).replace(/-/g, '').slice(0, 64);
  await client`
    INSERT INTO share_tokens (id, note_id, token, created_at)
    VALUES (${id}, ${noteId}, ${token}, NOW())
  `;
  return c.json({ token });
});

export default noteRoutes;
