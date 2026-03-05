import type { JudgeAdapter } from './base';

function extractTextFromAnthropicResponse(data: Record<string, unknown>): string {
  const content = Array.isArray(data.content) ? data.content : [];
  const chunks: string[] = [];

  for (const part of content) {
    if (!part || typeof part !== 'object') {
      continue;
    }

    if ((part as { type?: unknown }).type === 'text' && typeof (part as { text?: unknown }).text === 'string') {
      chunks.push((part as { text: string }).text);
    }
  }

  const text = chunks.join('\n').trim();
  if (!text) {
    throw new Error('Anthropic returned no text output.');
  }

  return text;
}

export const anthropicJudgeAdapter: JudgeAdapter = {
  async callModel({ model, apiKey, prompt }) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API request failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return extractTextFromAnthropicResponse(data);
  }
};
