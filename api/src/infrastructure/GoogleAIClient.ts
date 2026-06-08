import { config } from '../config';

function apiKey(): string {
  const key = config.google.apiKey;
  if (!key) throw new Error('GOOGLE_API_KEY environment variable is required');
  return key;
}

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${config.google.baseUrl}/models/${config.google.embedModel}:embedContent?key=${apiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${config.google.embedModel}`,
      content: { parts: [{ text }] },
    }),
  });
  if (!res.ok) throw new Error(`embedText failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { embedding: { values: number[] } };
  return data.embedding.values;
}

export async function generateText(opts: {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: opts.userPrompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? config.google.temperature,
      maxOutputTokens: opts.maxTokens ?? config.google.maxTokens,
    },
  };
  if (opts.systemPrompt) {
    body.system_instruction = { parts: [{ text: opts.systemPrompt }] };
  }
  const res = await fetch(`${config.google.baseUrl}/models/${config.google.chatModel}:generateContent?key=${apiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`generateText failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
