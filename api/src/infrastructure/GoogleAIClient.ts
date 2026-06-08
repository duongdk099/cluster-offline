import { GoogleGenAI } from '@google/genai';
import { config } from '../config';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!config.google.apiKey) {
    throw new Error('GOOGLE_API_KEY environment variable is required');
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.google.apiKey });
  }
  return client;
}

export async function embedText(text: string): Promise<number[]> {
  const result = await getClient().models.embedContent({
    model: config.google.embedModel,
    contents: text,
  });
  const values = result.embeddings?.[0]?.values;
  if (!Array.isArray(values)) {
    throw new Error('embedText: no embedding returned');
  }
  return values;
}

export async function generateText(opts: {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const result = await getClient().models.generateContent({
    model: config.google.chatModel,
    contents: opts.userPrompt,
    config: {
      systemInstruction: opts.systemPrompt,
      temperature: opts.temperature ?? config.google.temperature,
      maxOutputTokens: opts.maxTokens ?? config.google.maxTokens,
    },
  });
  if (typeof result.text === 'string') return result.text;
  return result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
