import { config } from '../config';

export async function deepseekChat(opts: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    model?: string;
    jsonMode?: boolean;
    temperature?: number;
    maxTokens?: number;
}): Promise<string> {
    const key = config.deepseek.apiKey;
    if (!key) throw new Error('DEEPSEEK_API_KEY environment variable is required');

    const body: Record<string, unknown> = {
        model: opts.model ?? config.deepseek.chatModel,
        messages: opts.messages,
        temperature: opts.temperature ?? config.deepseek.temperature,
        max_tokens: opts.maxTokens ?? config.deepseek.maxTokens,
    };

    if (opts.jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
        throw new Error('DeepSeek API returned no content');
    }

    return content;
}
