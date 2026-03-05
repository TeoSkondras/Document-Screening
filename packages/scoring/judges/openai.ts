import type { JudgeAdapter } from './base';

function extractTextFromOpenAIResponse(data: Record<string, unknown>): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];
  const chunks: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? ((item as { content: unknown[] }).content ?? [])
      : [];

    for (const part of content) {
      if (!part || typeof part !== 'object') {
        continue;
      }

      if (typeof (part as { text?: unknown }).text === 'string') {
        chunks.push((part as { text: string }).text);
      }
    }
  }

  const text = chunks.join('\n').trim();
  if (text) {
    return text;
  }

  throw new Error('OpenAI returned no text output.');
}

export const openaiJudgeAdapter: JudgeAdapter = {
  async callModel({ model, apiKey, prompt }) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: prompt
              }
            ]
          }
        ],
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API request failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return extractTextFromOpenAIResponse(data);
  }
};
