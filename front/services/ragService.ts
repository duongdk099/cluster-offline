import type { DetectedAction } from './aiService';
import type { ServiceResult } from './notesService';

export type { ServiceResult };

export type Citation = { noteId: string; chunkText: string; similarity: number };
export type AskResponse = {
  answer: string;
  citations: Citation[];
  intent: 'question' | 'action' | 'mixed';
  suggestedActions: DetectedAction[];
};

function apiUrl() {
  const config = useRuntimeConfig();
  return String(config.public.apiUrl || 'http://localhost:3001').replace(/\/$/, '');
}

function authHeaders(token: string | null): HeadersInit {
  if (!token) throw new Error('No auth token found');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function askRag(token: string | null, query: string): Promise<ServiceResult<AskResponse>> {
  try {
    const res = await fetch(`${apiUrl()}/rag/ask`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: text || 'Ask failed' };
    }
    return { success: true, data: await res.json() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ask failed' };
  }
}
