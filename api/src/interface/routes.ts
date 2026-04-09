import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { CreateNoteUseCase } from '../application/CreateNote';
import { GetNoteUseCase } from '../application/GetNote';
import { UpdateNoteUseCase } from '../application/UpdateNote';
import { DeleteNoteUseCase } from '../application/DeleteNote';
import { DrizzleNoteRepository } from '../infrastructure/DrizzleNoteRepository';
import { notifyChange } from '../infrastructure/websocket';

const noteRoutes = new Hono();
const MAX_TAGS_PER_NOTE = 20;
const MAX_TAG_LENGTH = 100;
const MAX_FOLDER_LENGTH = 100;

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
        .map((tag) => tag.slice(0, MAX_TAG_LENGTH)))];

    if (normalized.length > MAX_TAGS_PER_NOTE) {
        return null;
    }

    return normalized;
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
}
noteRoutes.use('*', jwt({ secret: jwtSecret, alg: 'HS256' }));

const noteRepository = new DrizzleNoteRepository();
const createNoteUseCase = new CreateNoteUseCase(noteRepository);
const getNoteUseCase = new GetNoteUseCase(noteRepository);
const updateNoteUseCase = new UpdateNoteUseCase(noteRepository);
const deleteNoteUseCase = new DeleteNoteUseCase(noteRepository);

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

    const name = body.name.trim().slice(0, MAX_FOLDER_LENGTH);
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
    const noteId = typeof body.id === 'string' && body.id.trim() ? body.id : undefined;
    const folderId = body.folderId === undefined || body.folderId === null
        ? null
        : (typeof body.folderId === 'string' ? body.folderId : undefined);

    if (tags === null) {
        return c.json({ error: 'Invalid tags format' }, 400);
    }
    if (folderId === undefined) {
        return c.json({ error: 'Invalid folderId format' }, 400);
    }

    const note = await createNoteUseCase.execute(payload.sub, body.title, body.content, tags, folderId, noteId);

    // Notify clients
    notifyChange(payload.sub, 'NOTE_CREATED', note.id);

    return c.json(note, 201);
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

    const tagName = body.name.trim().slice(0, MAX_TAG_LENGTH);

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

export default noteRoutes;
