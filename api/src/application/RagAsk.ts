import { client } from '../infrastructure/db';
import { embedText, generateText } from '../infrastructure/GoogleAIClient';
import { detectActionsInText, type DetectedAction } from './DetectActionsInNote';
import { config } from '../config';

type Citation = { noteId: string; chunkText: string; similarity: number };
type Intent = 'question' | 'action' | 'mixed';

async function classifyIntent(query: string): Promise<Intent> {
  try {
    const raw = await generateText({
      systemPrompt: "Classify the user's query intent into one of exactly three labels: 'question' (asking for information), 'action' (requesting something be done such as scheduling, sending, or reminding), or 'mixed' (both). Reply with ONLY the single label word, no punctuation.",
      userPrompt: query,
      temperature: 0,
      maxTokens: 8,
    });
    const label = raw.trim().toLowerCase().replace(/['".]/g, '');
    if (label === 'question' || label === 'action' || label === 'mixed') return label;
    return 'question';
  } catch {
    return 'question';
  }
}

async function rerankChunks(query: string, rows: Array<{ chunk_text: string; similarity: number }>): Promise<number[]> {
  if (rows.length === 0) return [];
  try {
    const numbered = rows
      .map((r, i) => `[${i}] ${r.chunk_text.slice(0, config.rag.rerankSnippetChars)}`)
      .join('\n\n');
    const raw = await generateText({
      systemPrompt: "You are a relevance scorer. Given a user query and numbered candidate passages, return ONLY a JSON object of the form { \"scores\": [n0, n1, ...] } where each value is an integer 0-10 indicating how relevant that passage is to answering the query. Same order as the input.",
      userPrompt: `Query: ${query}\n\nPassages:\n${numbered}`,
      temperature: 0,
      maxTokens: 256,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const scores = (parsed as { scores?: unknown })?.scores;
    if (!Array.isArray(scores) || scores.length !== rows.length) throw new Error('shape');
    return scores.map((s) => {
      const n = typeof s === 'number' ? s : Number(s);
      return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
    });
  } catch {
    return rows.map((r) => Math.max(0, Math.min(10, Math.round(r.similarity * 10))));
  }
}

export class RagAskUseCase {
  async execute(userId: string, query: string): Promise<{
    answer: string;
    citations: Citation[];
    intent: Intent;
    suggestedActions: DetectedAction[];
  }> {
    const queryVec = await embedText(query);
    const vecLit = '[' + queryVec.join(',') + ']';

    const rows = await client`
      SELECT nc.note_id, nc.chunk_text,
             1 - (nc.embedding <=> ${vecLit}::vector) AS similarity
      FROM note_chunks nc
      INNER JOIN notes n ON n.id = nc.note_id
      WHERE n.user_id = ${userId} AND n.deleted_at IS NULL
      ORDER BY nc.embedding <=> ${vecLit}::vector
      LIMIT ${client.unsafe(String(config.rag.retrieveTopK))}
    `;

    if (rows.length === 0) {
      return {
        answer: "I don't have any relevant notes indexed yet to answer that.",
        citations: [],
        intent: 'question',
        suggestedActions: [],
      };
    }

    const [intent, scores] = await Promise.all([
      classifyIntent(query),
      rerankChunks(query, rows as Array<{ chunk_text: string; similarity: number }>),
    ]);

    const ranked = (rows as Array<{ note_id: string; chunk_text: string; similarity: number }>)
      .map((row, i) => ({ ...row, score: scores[i] ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, config.rag.answerTopK);

    const context = ranked
      .map((r, i) => `Source [${i + 1}]: ${r.chunk_text}`)
      .join('\n\n');
    const systemPrompt = "You are a notes assistant. Answer the user's question using ONLY the sources below. Cite each claim with [1], [2], etc. matching the source numbers. If the sources don't answer the question, say so plainly. Keep the answer concise.";
    const userPrompt = `Sources:\n${context}\n\nQuestion: ${query}`;

    const answer = await generateText({ systemPrompt, userPrompt });

    let suggestedActions: DetectedAction[] = [];
    try {
      suggestedActions = await detectActionsInText(answer);
    } catch {
      suggestedActions = [];
    }

    return {
      answer,
      citations: ranked.map((r) => ({
        noteId: r.note_id,
        chunkText: r.chunk_text,
        similarity: Number(r.similarity),
      })),
      intent,
      suggestedActions,
    };
  }
}
