import { z } from 'zod';

import {
  MAX_JUDGES,
  MAX_MODEL_LENGTH,
  MAX_NOTES_CHARS
} from './constants';

export const providerSchema = z.enum(['openai', 'anthropic', 'gemini']);

export const judgeSpecSchema = z.object({
  provider: providerSchema,
  model: z
    .string()
    .trim()
    .min(1)
    .max(MAX_MODEL_LENGTH)
    .regex(/^[A-Za-z0-9._:/-]+$/, 'Model name contains invalid characters.')
});

export const judgesSchema = z.array(judgeSpecSchema).min(1).max(MAX_JUDGES);

export const apiKeysSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional()
}).strict();

export const notesSchema = z.string().trim().max(MAX_NOTES_CHARS).optional();

export const rubricRowSchema = z.object({
  criterion: z.string().min(1),
  description: z.string().optional(),
  max_points: z.number().positive(),
  weight: z.number().positive().optional()
});

export const criterionScoreSchema = z.object({
  score: z.number(),
  rationale: z.string()
});

export const judgeOutputSchema = z.object({
  scores: z.record(criterionScoreSchema),
  overall_rationale: z.string()
});

export const jobProgressSchema = z.object({
  phase: z.enum(['extract', 'judge', 'excel', 'upload']),
  pct: z.number().min(0).max(1),
  message: z.string()
});

export const jobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
