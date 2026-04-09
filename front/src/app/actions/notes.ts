'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { JSONContent } from '@tiptap/core';
import type { Note } from '@/lib/types';

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function getResponseError(res: Response, fallback: string) {
  const text = await res.text();
  return text || fallback;
}

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    throw new Error('No auth token found');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface NoteData {
  title: string;
  content: JSONContent;
  tags?: string[];
  folderId?: string | null;
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createNote(data: NoteData) {
  let noteId: string | null = null;

  try {
    const res = await fetch(`${API_URL}/notes`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to create note'),
      };
    }

    const note = await res.json();
    noteId = note.id;
    revalidatePath('/');
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to create note') };
  }

  if (noteId) {
    redirect(`/notes/${noteId}`);
  }

  return { success: false, error: 'Failed to create note' };
}

export async function updateNote(id: string, data: NoteData): Promise<ActionResult<Note>> {
  try {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to update note'),
      };
    }

    const note = await res.json();
    revalidatePath(`/notes/${id}`);
    revalidatePath('/');
    return { success: true, data: note };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to update note') };
  }
}

export async function deleteNote(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to delete note'),
      };
    }

    revalidatePath('/');
    revalidatePath('/notes/deleted');
    return { success: true, data: { id } };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to delete note') };
  }
}

export async function restoreNote(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const res = await fetch(`${API_URL}/notes/${id}/restore`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to restore note'),
      };
    }

    revalidatePath('/');
    revalidatePath('/notes/deleted');
    return { success: true, data: { id } };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to restore note') };
  }
}

export async function permanentDeleteNote(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const res = await fetch(`${API_URL}/notes/${id}/permanent`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to permanently delete note'),
      };
    }

    revalidatePath('/');
    revalidatePath('/notes/deleted');
    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to permanently delete note'),
    };
  }
}

export async function getNote(id: string): Promise<ActionResult<Note>> {
  try {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to fetch note'),
      };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to fetch note') };
  }
}

export async function getNotes(): Promise<ActionResult<Note[]>> {
  try {
    const res = await fetch(`${API_URL}/notes`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to fetch notes'),
      };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to fetch notes') };
  }
}

export async function getDeletedNotes(): Promise<ActionResult<Note[]>> {
  try {
    const res = await fetch(`${API_URL}/notes/deleted`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to fetch deleted notes'),
      };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to fetch deleted notes') };
  }
}

export async function searchNotes(query: string): Promise<ActionResult<Note[]>> {
  if (!query.trim()) {
    return getNotes();
  }

  try {
    const res = await fetch(`${API_URL}/notes/search?q=${encodeURIComponent(query)}`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        success: false,
        error: await getResponseError(res, 'Failed to search notes'),
      };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to search notes') };
  }
}
