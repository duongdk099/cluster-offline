'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  content: any;
}

export async function createNote(data: NoteData) {
  let noteId: string | null = null;

  try {
    const res = await fetch(`${API_URL}/notes`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.text();
      return { error: error || 'Failed to create note' };
    }

    const note = await res.json();
    noteId = note.id;
    revalidatePath('/');
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create note' };
  }

  if (noteId) {
    redirect(`/notes/${noteId}`);
  }
}

export async function updateNote(id: string, data: NoteData) {
  try {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.text();
      return { error: error || 'Failed to update note' };
    }

    const note = await res.json();
    revalidatePath(`/notes/${id}`);
    revalidatePath('/');
    return { success: true, note };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update note' };
  }
}

export async function deleteNote(id: string) {
  try {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });

    if (!res.ok) {
      const error = await res.text();
      return { error: error || 'Failed to delete note' };
    }

    revalidatePath('/');
    revalidatePath('/notes/deleted');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to delete note' };
  }
}

export async function restoreNote(id: string) {
  try {
    const res = await fetch(`${API_URL}/notes/${id}/restore`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });

    if (!res.ok) {
      const error = await res.text();
      return { error: error || 'Failed to restore note' };
    }

    revalidatePath('/');
    revalidatePath('/notes/deleted');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to restore note' };
  }
}

export async function permanentDeleteNote(id: string) {
  try {
    const res = await fetch(`${API_URL}/notes/${id}/permanent`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });

    if (!res.ok) {
      const error = await res.text();
      return { error: error || 'Failed to permanently delete note' };
    }

    revalidatePath('/');
    revalidatePath('/notes/deleted');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to permanently delete note' };
  }
}

export async function getNote(id: string) {
  try {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    return null;
  }
}

export async function getNotes() {
  try {
    const res = await fetch(`${API_URL}/notes`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return [];
    }

    return await res.json();
  } catch (error) {
    return [];
  }
}

export async function getDeletedNotes() {
  try {
    const res = await fetch(`${API_URL}/notes/deleted`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return [];
    }

    return await res.json();
  } catch (error) {
    return [];
  }
}

export async function searchNotes(query: string) {
  if (!query.trim()) {
    return getNotes();
  }

  try {
    const res = await fetch(`${API_URL}/notes/search?q=${encodeURIComponent(query)}`, {
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return [];
    }

    return await res.json();
  } catch (error) {
    return [];
  }
}
