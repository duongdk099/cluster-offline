export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type DetectedAction =
  | { type: 'calendar'; events: Array<{ title: string; date?: string; notes?: string }> }
  | { type: 'email'; to?: string; subject?: string; body?: string }
  | { type: 'notification'; message: string; when?: string };

function apiUrl() {
  const config = useRuntimeConfig();
  return String(config.public.apiUrl || 'http://localhost:3001').replace(/\/$/, '');
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function getResponseError(res: Response, fallback: string) {
  const text = await res.text();
  return text || fallback;
}

function authHeaders(token: string | null): HeadersInit {
  if (!token) throw new Error('No auth token found');

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function postAi<T>(
  token: string | null,
  noteId: string,
  verb: string,
  fallback: string,
): Promise<ServiceResult<T>> {
  try {
    const res = await fetch(`${apiUrl()}/notes/${noteId}/ai/${verb}`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      return { success: false, error: await getResponseError(res, fallback) };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, fallback) };
  }
}

export async function summarizeNote(
  token: string | null,
  noteId: string,
): Promise<ServiceResult<{ summary: string }>> {
  return postAi<{ summary: string }>(token, noteId, 'summarize', 'Failed to summarize note');
}

export async function suggestTagsForNote(
  token: string | null,
  noteId: string,
): Promise<ServiceResult<{ tags: string[] }>> {
  return postAi<{ tags: string[] }>(token, noteId, 'auto-tag', 'Failed to suggest tags');
}

export async function detectActionsInNote(
  token: string | null,
  noteId: string,
): Promise<ServiceResult<{ actions: DetectedAction[] }>> {
  return postAi<{ actions: DetectedAction[] }>(
    token,
    noteId,
    'extract-actions',
    'Failed to detect actions',
  );
}
