import type { Provider } from './types';

export const PROVIDER_ENV_KEY: Record<Provider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY'
};

export const JOB_QUEUE_NAME = 'resume-judge-jobs';
export const JOB_REDIS_KEY_PREFIX = 'resume-judge:job:';

export const JUDGE_JSON_SCHEMA_HINT = `{
  "scores": {
    "<criterion_id>": {
      "score": number,
      "rationale": string
    }
  },
  "overall_rationale": string
}`;

export const PROMPT_TEMPLATE = `You are a strict resume evaluator.

Return ONLY valid JSON, no markdown, no commentary.
The JSON must match this shape exactly:
{{SCHEMA_HINT}}

Rules:
- Include a \"scores\" object key for every rubric criterion_id.
- Each score must be numeric and between 0 and that criterion's max_points.
- Use concise rationales tied to resume evidence.
- If evidence is missing, score lower and explain briefly.
`;
