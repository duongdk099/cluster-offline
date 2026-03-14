import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { CreateNoteUseCase } from '../application/CreateNote';
import { GetNoteUseCase } from '../application/GetNote';
import { UpdateNoteUseCase } from '../application/UpdateNote';
import { DeleteNoteUseCase } from '../application/DeleteNote';
import { DrizzleNoteRepository } from '../infrastructure/DrizzleNoteRepository';
import { notifyChange } from '../infrastructure/websocket';

const noteRoutes = new Hono();

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
    
    if (!query.trim()) {
        // Return all notes if no search query
        const notes = await noteRepository.findAll(payload.sub);
        return c.json(notes);
    }
    
    const notes = await noteRepository.search(payload.sub, query);
    return c.json(notes);
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
    const note = await createNoteUseCase.execute(payload.sub, body.title, body.content);

    // Notify clients
    notifyChange(payload.sub, 'NOTE_CREATED', note.id);

    return c.json(note, 201);
});

noteRoutes.get('/', async (c) => {
    const payload = c.get('jwtPayload') as { sub: string };
    const notes = await noteRepository.findAll(payload.sub);
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

    const note = await updateNoteUseCase.execute(id, payload.sub, body.title, body.content);
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
