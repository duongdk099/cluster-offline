import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import {
  createNote,
  updateNote,
  getNote,
  getNotes,
  deleteNote,
  restoreNote,
  searchNotes,
  createFolder,
  addTagToNote,
} from '~/services/notesService';

const API = 'https://api.example.com';
const content = { type: 'doc' } as JSONContent;

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('notesService', () => {
  it('createNote POSTs to /notes with the bearer token and returns data', async () => {
    const note = { id: 'n1', title: 'X' };
    const fetchMock = mockFetch(note);
    vi.stubGlobal('fetch', fetchMock);

    const result = await createNote('tok', { title: 'X', content });

    expect(result).toEqual({ success: true, data: note });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/notes`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toMatchObject({ title: 'X' });
  });

  it('createNote without a token fails gracefully and never calls fetch', async () => {
    const fetchMock = mockFetch({});
    vi.stubGlobal('fetch', fetchMock);

    const result = await createNote(null, { title: 'X', content });

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getNotes returns the array on success', async () => {
    vi.stubGlobal('fetch', mockFetch([{ id: 'a' }, { id: 'b' }]));
    const result = await getNotes('tok');
    expect(result).toEqual({ success: true, data: [{ id: 'a' }, { id: 'b' }] });
  });

  it('surfaces the server error body on a non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch('Note not found', false, 404));
    const result = await getNote('tok', 'missing');
    expect(result).toEqual({ success: false, error: 'Note not found' });
  });

  it('updateNote PATCHes /notes/:id', async () => {
    const fetchMock = mockFetch({ id: 'n1', title: 'New' });
    vi.stubGlobal('fetch', fetchMock);

    await updateNote('tok', 'n1', { title: 'New' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/notes/n1`);
    expect(init.method).toBe('PATCH');
  });

  it('deleteNote DELETEs /notes/:id and echoes the id', async () => {
    const fetchMock = mockFetch({});
    vi.stubGlobal('fetch', fetchMock);

    const result = await deleteNote('tok', 'n1');

    expect(result).toEqual({ success: true, data: { id: 'n1' } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/notes/n1`);
    expect(init.method).toBe('DELETE');
  });

  it('restoreNote POSTs /notes/:id/restore', async () => {
    const fetchMock = mockFetch({});
    vi.stubGlobal('fetch', fetchMock);

    await restoreNote('tok', 'n1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/notes/n1/restore`);
    expect(init.method).toBe('POST');
  });

  it('searchNotes with a blank query falls back to GET /notes (no /search)', async () => {
    const fetchMock = mockFetch([]);
    vi.stubGlobal('fetch', fetchMock);

    await searchNotes('tok', '   ');

    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/notes`);
  });

  it('searchNotes builds a /search?q= url for a real query', async () => {
    const fetchMock = mockFetch([]);
    vi.stubGlobal('fetch', fetchMock);

    await searchNotes('tok', 'hello');

    expect(fetchMock.mock.calls[0][0]).toContain(`${API}/notes/search?q=hello`);
  });

  it('createFolder POSTs to /notes/folders', async () => {
    const fetchMock = mockFetch({ id: 'f1', name: 'Projects' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createFolder('tok', 'Projects');

    expect(result).toEqual({ success: true, data: { id: 'f1', name: 'Projects' } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/notes/folders`);
  });

  it('addTagToNote POSTs to /notes/:id/tags with the tag name', async () => {
    const fetchMock = mockFetch({ id: 't1', name: 'urgent' });
    vi.stubGlobal('fetch', fetchMock);

    await addTagToNote('tok', 'n1', 'urgent');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/notes/n1/tags`);
    expect(JSON.parse(init.body)).toEqual({ name: 'urgent' });
  });
});
