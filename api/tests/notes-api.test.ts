import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { randomUUID } from 'crypto';
import {
    app,
    client,
    registerAndLogin,
    cleanupTestUsers,
    uniqueEmail,
    sampleContent,
    type Auth,
} from './helpers';

// All DB-touching tests live in this one file so there is a single connection
// lifecycle: clean up the rows we created, then close the pool so the test
// process can exit.
afterAll(async () => {
    await cleanupTestUsers();
    await client.end({ timeout: 5 });
});

const J = { 'Content-Type': 'application/json' };

describe('auth routes', () => {
    it('registers a new user (201) and never leaks the password hash', async () => {
        const email = uniqueEmail();
        const res = await app.request('/auth/register', {
            method: 'POST',
            headers: J,
            body: JSON.stringify({ email, password: 'Passw0rd!' }),
        });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.email).toBe(email);
        expect(body.id).toBeString();
        expect(body).not.toHaveProperty('passwordHash');
    });

    it('rejects an invalid email format (400)', async () => {
        const res = await app.request('/auth/register', {
            method: 'POST',
            headers: J,
            body: JSON.stringify({ email: 'not-an-email', password: 'Passw0rd!' }),
        });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('email');
    });

    it('rejects a password shorter than 8 chars (400)', async () => {
        const res = await app.request('/auth/register', {
            method: 'POST',
            headers: J,
            body: JSON.stringify({ email: uniqueEmail(), password: 'short' }),
        });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('8 characters');
    });

    it('rejects a duplicate registration (400)', async () => {
        const email = uniqueEmail();
        const payload = { email, password: 'Passw0rd!' };
        const first = await app.request('/auth/register', { method: 'POST', headers: J, body: JSON.stringify(payload) });
        expect(first.status).toBe(201);
        const second = await app.request('/auth/register', { method: 'POST', headers: J, body: JSON.stringify(payload) });
        expect(second.status).toBe(400);
        expect((await second.json()).error).toContain('already exists');
    });

    it('logs in with valid credentials and returns a JWT (200)', async () => {
        const email = uniqueEmail();
        await app.request('/auth/register', { method: 'POST', headers: J, body: JSON.stringify({ email, password: 'Passw0rd!' }) });
        const res = await app.request('/auth/login', { method: 'POST', headers: J, body: JSON.stringify({ email, password: 'Passw0rd!' }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.token).toBeString();
        expect(body.user.email).toBe(email);
    });

    it('rejects login with a wrong password (401)', async () => {
        const email = uniqueEmail();
        await app.request('/auth/register', { method: 'POST', headers: J, body: JSON.stringify({ email, password: 'Passw0rd!' }) });
        const res = await app.request('/auth/login', { method: 'POST', headers: J, body: JSON.stringify({ email, password: 'WrongPass1!' }) });
        expect(res.status).toBe(401);
    });

    it('rejects login for a non-existent user (401)', async () => {
        const res = await app.request('/auth/login', { method: 'POST', headers: J, body: JSON.stringify({ email: uniqueEmail(), password: 'Passw0rd!' }) });
        expect(res.status).toBe(401);
    });
});

describe('notes auth guard', () => {
    it('rejects unauthenticated access to /notes (401)', async () => {
        const res = await app.request('/notes', { method: 'GET' });
        expect(res.status).toBe(401);
    });

    it('rejects a malformed bearer token (401)', async () => {
        const res = await app.request('/notes', { method: 'GET', headers: { Authorization: 'Bearer not.a.jwt' } });
        expect(res.status).toBe(401);
    });
});

describe('notes CRUD', () => {
    let auth: Auth;
    beforeAll(async () => { auth = await registerAndLogin(); });

    async function createNote(overrides: Record<string, unknown> = {}) {
        const res = await app.request('/notes', {
            method: 'POST',
            headers: auth.headers,
            body: JSON.stringify({ title: 'My note', content: sampleContent, ...overrides }),
        });
        return res;
    }

    it('creates a note (201) with extracted contentText and empty tags', async () => {
        const res = await createNote();
        expect(res.status).toBe(201);
        const note = await res.json();
        expect(note.id).toBeString();
        expect(note.title).toBe('My note');
        expect(note.contentText).toBe('Hello world');
        expect(note.tags).toEqual([]);
        expect(note.folderId).toBeNull();
    });

    it('creates a note with tags attached', async () => {
        const res = await createNote({ title: 'Tagged', tags: ['work', 'urgent'] });
        expect(res.status).toBe(201);
        const note = await res.json();
        const names = (note.tags as Array<{ name: string }>).map((t) => t.name).sort();
        expect(names).toEqual(['urgent', 'work']);
    });

    it('rejects a non-array tags field (400)', async () => {
        const res = await createNote({ tags: 'work' });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('tags');
    });

    it('rejects a non-string folderId (400)', async () => {
        const res = await createNote({ folderId: 123 });
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain('folderId');
    });

    it('lists notes including the created one', async () => {
        const created = await (await createNote({ title: 'Listed' })).json();
        const res = await app.request('/notes', { method: 'GET', headers: auth.headers });
        expect(res.status).toBe(200);
        const notes = await res.json();
        expect(notes.some((n: { id: string }) => n.id === created.id)).toBe(true);
    });

    it('gets a note by id (200) and 404s for an unknown id', async () => {
        const created = await (await createNote()).json();
        const ok = await app.request(`/notes/${created.id}`, { method: 'GET', headers: auth.headers });
        expect(ok.status).toBe(200);
        expect((await ok.json()).id).toBe(created.id);

        const missing = await app.request(`/notes/${randomUUID()}`, { method: 'GET', headers: auth.headers });
        expect(missing.status).toBe(404);
    });

    it('updates a note via PUT (200)', async () => {
        const created = await (await createNote()).json();
        const res = await app.request(`/notes/${created.id}`, {
            method: 'PUT',
            headers: auth.headers,
            body: JSON.stringify({ title: 'Updated title', content: sampleContent }),
        });
        expect(res.status).toBe(200);
        expect((await res.json()).title).toBe('Updated title');
    });

    it('updates a note via PATCH (200)', async () => {
        const created = await (await createNote()).json();
        const res = await app.request(`/notes/${created.id}`, {
            method: 'PATCH',
            headers: auth.headers,
            body: JSON.stringify({ title: 'Patched title' }),
        });
        expect(res.status).toBe(200);
        expect((await res.json()).title).toBe('Patched title');
    });

    it('404s when updating an unknown note', async () => {
        const res = await app.request(`/notes/${randomUUID()}`, {
            method: 'PUT',
            headers: auth.headers,
            body: JSON.stringify({ title: 'x', content: sampleContent }),
        });
        expect(res.status).toBe(404);
    });

    it('soft-deletes a note, hides it from list/get, then shows it in trash', async () => {
        const created = await (await createNote({ title: 'To trash' })).json();

        const del = await app.request(`/notes/${created.id}`, { method: 'DELETE', headers: auth.headers });
        expect(del.status).toBe(200);

        const get = await app.request(`/notes/${created.id}`, { method: 'GET', headers: auth.headers });
        expect(get.status).toBe(404);

        const trash = await (await app.request('/notes/deleted', { method: 'GET', headers: auth.headers })).json();
        expect(trash.some((n: { id: string }) => n.id === created.id)).toBe(true);

        const list = await (await app.request('/notes', { method: 'GET', headers: auth.headers })).json();
        expect(list.some((n: { id: string }) => n.id === created.id)).toBe(false);
    });

    it('restores a soft-deleted note', async () => {
        const created = await (await createNote({ title: 'Restore me' })).json();
        await app.request(`/notes/${created.id}`, { method: 'DELETE', headers: auth.headers });

        const restore = await app.request(`/notes/${created.id}/restore`, { method: 'POST', headers: auth.headers });
        expect(restore.status).toBe(200);

        const get = await app.request(`/notes/${created.id}`, { method: 'GET', headers: auth.headers });
        expect(get.status).toBe(200);
    });

    it('404s when restoring an unknown note', async () => {
        const res = await app.request(`/notes/${randomUUID()}/restore`, { method: 'POST', headers: auth.headers });
        expect(res.status).toBe(404);
    });

    it('permanently deletes a trashed note', async () => {
        const created = await (await createNote({ title: 'Gone forever' })).json();
        await app.request(`/notes/${created.id}`, { method: 'DELETE', headers: auth.headers });

        const perm = await app.request(`/notes/${created.id}/permanent`, { method: 'DELETE', headers: auth.headers });
        expect(perm.status).toBe(200);

        const trash = await (await app.request('/notes/deleted', { method: 'GET', headers: auth.headers })).json();
        expect(trash.some((n: { id: string }) => n.id === created.id)).toBe(false);
    });

    it('404s when permanently deleting an unknown note', async () => {
        const res = await app.request(`/notes/${randomUUID()}/permanent`, { method: 'DELETE', headers: auth.headers });
        expect(res.status).toBe(404);
    });
});

describe('tags', () => {
    let auth: Auth;
    beforeAll(async () => { auth = await registerAndLogin(); });

    it('adds a tag to a note, lists it, filters by it, then removes it', async () => {
        const note = await (await app.request('/notes', {
            method: 'POST', headers: auth.headers,
            body: JSON.stringify({ title: 'Tag flow', content: sampleContent }),
        })).json();

        const add = await app.request(`/notes/${note.id}/tags`, {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ name: 'project-x' }),
        });
        expect(add.status).toBe(201);
        const tag = await add.json();
        expect(tag.name).toBe('project-x');

        const tags = await (await app.request('/notes/tags', { method: 'GET', headers: auth.headers })).json();
        expect(tags.some((t: { name: string }) => t.name === 'project-x')).toBe(true);

        const byTag = await (await app.request('/notes?tag=project-x', { method: 'GET', headers: auth.headers })).json();
        expect(byTag.some((n: { id: string }) => n.id === note.id)).toBe(true);

        const remove = await app.request(`/notes/${note.id}/tags/${tag.id}`, { method: 'DELETE', headers: auth.headers });
        expect(remove.status).toBe(200);
    });

    it('rejects an empty tag name (400)', async () => {
        const note = await (await app.request('/notes', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ title: 'x', content: sampleContent }),
        })).json();
        const res = await app.request(`/notes/${note.id}/tags`, {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ name: '   ' }),
        });
        expect(res.status).toBe(400);
    });

    it('404s when tagging an unknown note', async () => {
        const res = await app.request(`/notes/${randomUUID()}/tags`, {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ name: 'whatever' }),
        });
        expect(res.status).toBe(404);
    });
});

describe('folders', () => {
    let auth: Auth;
    beforeAll(async () => { auth = await registerAndLogin(); });

    it('creates a folder, lists it, and assigns it to a note', async () => {
        const folder = await (await app.request('/notes/folders', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ name: 'Projects' }),
        })).json();
        expect(folder.id).toBeString();
        expect(folder.name).toBe('Projects');

        const folders = await (await app.request('/notes/folders', { method: 'GET', headers: auth.headers })).json();
        expect(folders.some((f: { id: string }) => f.id === folder.id)).toBe(true);

        const note = await (await app.request('/notes', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ title: 'In folder', content: sampleContent }),
        })).json();

        const assign = await app.request(`/notes/${note.id}/folder`, {
            method: 'PATCH', headers: auth.headers, body: JSON.stringify({ folderId: folder.id }),
        });
        expect(assign.status).toBe(200);

        const fetched = await (await app.request(`/notes/${note.id}`, { method: 'GET', headers: auth.headers })).json();
        expect(fetched.folderId).toBe(folder.id);
        expect(fetched.folder?.name).toBe('Projects');

        const byFolder = await (await app.request(`/notes?folder=${folder.id}`, { method: 'GET', headers: auth.headers })).json();
        expect(byFolder.some((n: { id: string }) => n.id === note.id)).toBe(true);
    });

    it('creates a note directly inside a folder', async () => {
        const folder = await (await app.request('/notes/folders', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ name: 'Inbox' }),
        })).json();
        const note = await (await app.request('/notes', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ title: 'Direct', content: sampleContent, folderId: folder.id }),
        })).json();
        expect(note.folderId).toBe(folder.id);
    });

    it('rejects an empty folder name (400)', async () => {
        const res = await app.request('/notes/folders', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ name: '' }),
        });
        expect(res.status).toBe(400);
    });

    it('404s when assigning an unknown folder to a note', async () => {
        const note = await (await app.request('/notes', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ title: 'x', content: sampleContent }),
        })).json();
        const res = await app.request(`/notes/${note.id}/folder`, {
            method: 'PATCH', headers: auth.headers, body: JSON.stringify({ folderId: randomUUID() }),
        });
        expect(res.status).toBe(404);
    });
});

describe('search', () => {
    let auth: Auth;
    beforeAll(async () => { auth = await registerAndLogin(); });

    it('finds a note by a distinctive word in its content', async () => {
        const marker = `zelkova-${randomUUID().slice(0, 8)}`;
        const content = {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: `unique ${marker} term` }] }],
        };
        await app.request('/notes', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ title: 'Searchable', content }),
        });

        const res = await app.request(`/notes/search?q=${marker}`, { method: 'GET', headers: auth.headers });
        expect(res.status).toBe(200);
        const found = await res.json();
        expect(found.length).toBe(1);
        expect(found[0].title).toBe('Searchable');
    });

    it('returns all notes when no query/filter is given', async () => {
        await app.request('/notes', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ title: 'Anything', content: sampleContent }),
        });
        const res = await app.request('/notes/search', { method: 'GET', headers: auth.headers });
        expect(res.status).toBe(200);
        expect((await res.json()).length).toBeGreaterThan(0);
    });
});

describe('user isolation', () => {
    it("does not expose another user's note", async () => {
        const alice = await registerAndLogin();
        const bob = await registerAndLogin();

        const aliceNote = await (await app.request('/notes', {
            method: 'POST', headers: alice.headers, body: JSON.stringify({ title: "Alice's secret", content: sampleContent }),
        })).json();

        const asBob = await app.request(`/notes/${aliceNote.id}`, { method: 'GET', headers: bob.headers });
        expect(asBob.status).toBe(404);
    });
});

describe('password recovery', () => {
    it('responds with a generic message to forget-password (200)', async () => {
        const auth = await registerAndLogin();
        const res = await app.request('/auth/forget-password', {
            method: 'POST', headers: J, body: JSON.stringify({ email: auth.email }),
        });
        expect(res.status).toBe(200);
    });

    it('resets the password with a valid token, then logs in with the new one', async () => {
        const email = uniqueEmail();
        const oldPassword = 'Passw0rd!';
        const newPassword = 'NewPassw0rd!';
        await app.request('/auth/register', { method: 'POST', headers: J, body: JSON.stringify({ email, password: oldPassword }) });
        await app.request('/auth/forget-password', { method: 'POST', headers: J, body: JSON.stringify({ email }) });

        const rows = await client`SELECT reset_token FROM users WHERE email = ${email}`;
        const token = rows[0]?.reset_token as string;
        expect(token).toBeString();

        const reset = await app.request('/auth/reset-password', { method: 'POST', headers: J, body: JSON.stringify({ token, newPassword }) });
        expect(reset.status).toBe(200);

        const oldLogin = await app.request('/auth/login', { method: 'POST', headers: J, body: JSON.stringify({ email, password: oldPassword }) });
        expect(oldLogin.status).toBe(401);

        const newLogin = await app.request('/auth/login', { method: 'POST', headers: J, body: JSON.stringify({ email, password: newPassword }) });
        expect(newLogin.status).toBe(200);
    });

    it('rejects a reset with an invalid token (400)', async () => {
        const res = await app.request('/auth/reset-password', {
            method: 'POST', headers: J, body: JSON.stringify({ token: 'does-not-exist', newPassword: 'NewPassw0rd!' }),
        });
        expect(res.status).toBe(400);
    });
});

describe('export', () => {
    let auth: Auth;
    beforeAll(async () => { auth = await registerAndLogin(); });

    it('exports a note as markdown (200) containing its text', async () => {
        const note = await (await app.request('/notes', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ title: 'Exportable', content: sampleContent }),
        })).json();
        const res = await app.request(`/notes/${note.id}/export/md`, { method: 'GET', headers: auth.headers });
        expect(res.status).toBe(200);
        expect(await res.text()).toContain('Hello world');
    });

    it('rejects an unsupported export format (400)', async () => {
        const note = await (await app.request('/notes', {
            method: 'POST', headers: auth.headers, body: JSON.stringify({ title: 'x', content: sampleContent }),
        })).json();
        const res = await app.request(`/notes/${note.id}/export/xml`, { method: 'GET', headers: auth.headers });
        expect(res.status).toBe(400);
    });

    it('404s when exporting an unknown note', async () => {
        const res = await app.request(`/notes/${randomUUID()}/export/md`, { method: 'GET', headers: auth.headers });
        expect(res.status).toBe(404);
    });
});
