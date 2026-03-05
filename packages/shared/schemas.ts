import { z } from 'zod';

export const providerSchema = z.enum(['openai', 'anthropic', 'gemini']);

export const judgeSpecSchema = z.object({
  provider: providerSchema,
  model: z.string().min(1)
});

export const judgesSchema = z.array(judgeSpecSchema).min(1);

export const apiKeysSchema = z.record(z.string().min(1), z.string().min(1));

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
