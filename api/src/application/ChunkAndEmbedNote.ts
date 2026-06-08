import { createHash, randomUUID } from 'crypto';
import { INoteRepository } from '../domain/Note';
import { extractNoteText } from './extractNoteText';
import { embedText } from '../infrastructure/GoogleAIClient';
import { client } from '../infrastructure/db';

const TARGET_MAX = 3200; // ~800 tokens at ~4 chars/token

export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > TARGET_MAX && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export class ChunkAndEmbedNoteUseCase {
  constructor(private noteRepository: INoteRepository) {}

  async execute(noteId: string, userId: string): Promise<{ chunks: number; cached?: boolean }> {
    const note = await this.noteRepository.findById(noteId, userId);
    if (!note) return { chunks: 0 };

    const text = extractNoteText(note.content);
    if (!text.trim()) {
      // Empty note — clear chunks if any existed.
      await client`DELETE FROM note_chunks WHERE note_id = ${noteId}`;
      return { chunks: 0 };
    }

    const hash = createHash('sha256').update(text).digest('hex');

    // Cache check: if any existing chunk has the same hash, skip.
    const existing = await client`SELECT content_hash FROM note_chunks WHERE note_id = ${noteId} LIMIT 1`;
    if (existing.length > 0 && existing[0].content_hash === hash) {
      return { chunks: 0, cached: true };
    }

    await client`DELETE FROM note_chunks WHERE note_id = ${noteId}`;

    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vec = await embedText(chunk);
      const vecLit = '[' + vec.join(',') + ']';
      await client`
        INSERT INTO note_chunks (id, note_id, content_hash, chunk_index, chunk_text, embedding)
        VALUES (${randomUUID()}, ${noteId}, ${hash}, ${i}, ${chunk}, ${vecLit}::vector)
      `;
    }

    return { chunks: chunks.length };
  }
}
