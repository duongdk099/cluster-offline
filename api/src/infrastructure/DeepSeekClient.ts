import OpenAI from 'openai';
import { config } from '../config';

let client: OpenAI | null = null;

function getClient(): OpenAI {
    if (!config.deepseek.apiKey) {
        throw new Error('DEEPSEEK_API_KEY environment variable is required');
    }
    if (!client) {
        client = new OpenAI({
            apiKey: config.deepseek.apiKey,
            baseURL: config.deepseek.baseUrl,
        });
    }
    return client;
}

export async function deepseekChat(opts: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    model?: string;
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
}): Promise<string> {
    const completion = await getClient().chat.completions.create({
        model: opts.model ?? config.deepseek.chatModel,
        messages: opts.messages,
        temperature: opts.temperature ?? config.deepseek.temperature,
        max_tokens: opts.maxTokens ?? config.deepseek.maxTokens,
        response_format: opts.jsonMode ? { type: 'json_object' } : undefined,
    });
    return completion.choices[0]?.message?.content ?? '';
}
