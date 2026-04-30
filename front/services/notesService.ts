import type { JSONContent } from '@tiptap/core';
import type { Note, NoteFolder, NoteTag } from '~/types/notes';

export interface NoteData {
  title: string;
  content: JSONContent;
  tags?: string[];
  folderId?: string | null;
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

type NoteFilters = {
  tag?: string;
  folder?: string;
};

function apiUrl() {
  const config = useRuntimeConfig();
  return String(config.public.apiUrl || 'http://localhost:3001').replace(/\/$/, '');
}

function notesUrl() {
  return `${apiUrl()}/notes`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function getResponseError(res: Response, fallback: string) {
  const text = await res.text();
  return text || fallback;
}

function authHeaders(token: string | null, json = true): HeadersInit {
  if (!token) throw new Error('No auth token found');

  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

function filteredNotesUrl(path = '', filters?: NoteFilters) {
  const params = new URLSearchParams();
  if (filters?.tag) params.set('tag', filters.tag);
  if (filters?.folder) params.set('folder', filters.folder);

  const query = params.toString();
  return `${notesUrl()}${path}${query ? `?${query}` : ''}`;
}

export async function createNote(token: string | null, data: NoteData): Promise<ServiceResult<Note>> {
  try {
    const res = await fetch(notesUrl(), {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to create note') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to create note') };
  }
}

export async function updateNote(token: string | null, id: string, data: Partial<NoteData>): Promise<ServiceResult<Note>> {
  try {
    const res = await fetch(`${notesUrl()}/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to update note') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to update note') };
  }
}

export async function deleteNote(token: string | null, id: string): Promise<ServiceResult<{ id: string }>> {
  try {
    const res = await fetch(`${notesUrl()}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to delete note') };
    }

    return { success: true, data: { id } };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to delete note') };
  }
}

export async function restoreNote(token: string | null, id: string): Promise<ServiceResult<{ id: string }>> {
  try {
    const res = await fetch(`${notesUrl()}/${id}/restore`, {
      method: 'POST',
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to restore note') };
    }

    return { success: true, data: { id } };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to restore note') };
  }
}

export async function permanentDeleteNote(token: string | null, id: string): Promise<ServiceResult<{ id: string }>> {
  try {
    const res = await fetch(`${notesUrl()}/${id}/permanent`, {
      method: 'DELETE',
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to permanently delete note'),
      };
    }

    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to permanently delete note'),
    };
  }
}

export async function getNote(token: string | null, id: string): Promise<ServiceResult<Note>> {
  try {
    const res = await fetch(`${notesUrl()}/${id}`, {
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to fetch note') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to fetch note') };
  }
}

export async function getNotes(token: string | null, filters?: NoteFilters): Promise<ServiceResult<Note[]>> {
  try {
    const res = await fetch(filteredNotesUrl('', filters), {
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to fetch notes') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to fetch notes') };
  }
}

export async function getDeletedNotes(token: string | null): Promise<ServiceResult<Note[]>> {
  try {
    const res = await fetch(`${notesUrl()}/deleted`, {
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to fetch deleted notes') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to fetch deleted notes') };
  }
}

export async function searchNotes(token: string | null, query: string, filters?: NoteFilters): Promise<ServiceResult<Note[]>> {
  if (!query.trim()) {
    return getNotes(token, filters);
  }

  try {
    const params = new URLSearchParams({ q: query.trim() });
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.folder) params.set('folder', filters.folder);

    const res = await fetch(`${notesUrl()}/search?${params.toString()}`, {
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to search notes') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to search notes') };
  }
}

export async function getTags(token: string | null): Promise<ServiceResult<NoteTag[]>> {
  try {
    const res = await fetch(`${notesUrl()}/tags`, {
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to fetch tags') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to fetch tags') };
  }
}

export async function getFolders(token: string | null): Promise<ServiceResult<NoteFolder[]>> {
  try {
    const res = await fetch(`${notesUrl()}/folders`, {
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to fetch folders') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to fetch folders') };
  }
}

export async function addTagToNote(token: string | null, id: string, name: string) {
  try {
    const res = await fetch(`${notesUrl()}/${id}/tags`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to add tag') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to add tag') };
  }
}

export async function removeTagFromNote(token: string | null, id: string, tagId: string) {
  try {
    const res = await fetch(`${notesUrl()}/${id}/tags/${tagId}`, {
      method: 'DELETE',
      headers: authHeaders(token, false),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to remove tag') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to remove tag') };
  }
}

export async function createFolder(token: string | null, name: string): Promise<ServiceResult<NoteFolder>> {
  try {
    const res = await fetch(`${notesUrl()}/folders`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to create folder') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to create folder') };
  }
}

export async function assignFolderToNote(token: string | null, id: string, folderId: string | null): Promise<ServiceResult<Note>> {
  try {
    const res = await fetch(`${notesUrl()}/${id}/folder`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ folderId }),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Failed to assign folder') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to assign folder') };
  }
}

export async function uploadImage(token: string | null, file: File): Promise<ServiceResult<{ url: string }>> {
  try {
    if (!token) throw new Error('No auth token found');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${apiUrl()}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, 'Upload failed') };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Upload failed') };
  }
}
