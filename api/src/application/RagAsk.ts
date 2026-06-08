import { client } from '../infrastructure/db';
import { embedText, generateText } from '../infrastructure/GoogleAIClient';

type Citation = { noteId: string; chunkText: string; similarity: number };

export class RagAskUseCase {
  async execute(userId: string, query: string): Promise<{ answer: string; citations: Citation[] }> {
    const queryVec = await embedText(query);
    const vecLit = '[' + queryVec.join(',') + ']';

    const rows = await client`
      SELECT nc.note_id, nc.chunk_text,
             1 - (nc.embedding <=> ${vecLit}::vector) AS similarity
      FROM note_chunks nc
      INNER JOIN notes n ON n.id = nc.note_id
      WHERE n.user_id = ${userId} AND n.deleted_at IS NULL
      ORDER BY nc.embedding <=> ${vecLit}::vector
      LIMIT 8
    `;

    if (rows.length === 0) {
      return { answer: "I don't have any relevant notes indexed yet to answer that.", citations: [] };
    }

    const context = rows.map((r, i) => `Source [${i + 1}]: ${r.chunk_text}`).join('\n\n');
    const systemPrompt = "You are a notes assistant. Answer the user's question using ONLY the sources below. Cite each claim with [1], [2], etc. matching the source numbers. If the sources don't answer the question, say so plainly. Keep the answer concise.";
    const userPrompt = `Sources:\n${context}\n\nQuestion: ${query}`;

    const answer = await generateText({ systemPrompt, userPrompt });

    return {
      answer,
      citations: rows.map((r) => ({
        noteId: r.note_id as string,
        chunkText: r.chunk_text as string,
        similarity: Number(r.similarity),
      })),
    };
  }
}
