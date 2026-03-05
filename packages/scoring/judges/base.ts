import type { Provider } from '@shared/types';

import { anthropicJudgeAdapter } from './anthropic';
import { geminiJudgeAdapter } from './gemini';
import { openaiJudgeAdapter } from './openai';

export interface JudgeAdapter {
  callModel(args: { model: string; apiKey: string; prompt: string }): Promise<string>;
}

export function getJudgeAdapter(provider: Provider): JudgeAdapter {
  if (provider === 'openai') {
    return openaiJudgeAdapter;
  }

  if (provider === 'anthropic') {
    return anthropicJudgeAdapter;
  }

  if (provider === 'gemini') {
    return geminiJudgeAdapter;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
