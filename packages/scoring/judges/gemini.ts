import type { JudgeAdapter } from './base';

function normalizeGeminiModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    throw new Error('Gemini model must be a non-empty string.');
  }

  return trimmed.startsWith('models/') ? trimmed : `models/${trimmed}`;
}

function extractTextFromGeminiResponse(data: Record<string, unknown>): string {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const first = candidates[0];

  if (!first || typeof first !== 'object') {
    throw new Error('Gemini returned no candidates.');
  }

  const content = (first as { content?: unknown }).content;
  if (!content || typeof content !== 'object') {
    throw new Error('Gemini candidate had no content.');
  }

  const parts = Array.isArray((content as { parts?: unknown[] }).parts)
    ? ((content as { parts: unknown[] }).parts ?? [])
    : [];

  const chunks = parts
    .map((part) => (part && typeof part === 'object' ? (part as { text?: unknown }).text : null))
    .filter((text): text is string => typeof text === 'string' && text.trim().length > 0);

  const text = chunks.join('\n').trim();
  if (!text) {
    throw new Error('Gemini returned no text output.');
  }

  return text;
}

export const geminiJudgeAdapter: JudgeAdapter = {
  async callModel({ model, apiKey, prompt }) {
    const modelPath = normalizeGeminiModel(model);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0
        }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API request failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return extractTextFromGeminiResponse(data);
  }
};
