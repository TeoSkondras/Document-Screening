import { PROVIDER_ENV_KEY } from '@shared/constants';
import { judgeOutputSchema } from '@shared/schemas';
import type { JudgeSpec, ResumeJudgeResult, ResumeText, Rubric } from '@shared/types';

import { buildPrompt, buildRepairPrompt } from '../prompt/buildPrompt';
import { getJudgeAdapter } from '../judges/base';

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function tryParseJson(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = trimmed.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }

    throw new Error('Model response was not valid JSON.');
  }
}

async function callWithRepair(args: {
  judge: JudgeSpec;
  apiKey: string;
  prompt: string;
}): Promise<string> {
  const adapter = getJudgeAdapter(args.judge.provider);
  const firstResponse = await adapter.callModel({
    model: args.judge.model,
    apiKey: args.apiKey,
    prompt: args.prompt
  });

  try {
    tryParseJson(firstResponse);
    return firstResponse;
  } catch {
    const repairedResponse = await adapter.callModel({
      model: args.judge.model,
      apiKey: args.apiKey,
      prompt: buildRepairPrompt({
        originalPrompt: args.prompt,
        previousResponse: firstResponse
      })
    });

    tryParseJson(repairedResponse);
    return repairedResponse;
  }
}

export async function runJudgeOnResume(args: {
  judge: JudgeSpec;
  rubric: Rubric;
  notes?: string;
  resume: ResumeText;
  apiKeys: Partial<Record<string, string>>;
}): Promise<ResumeJudgeResult> {
  const apiKeyName = PROVIDER_ENV_KEY[args.judge.provider];
  const apiKey = args.apiKeys[apiKeyName];

  if (!apiKey) {
    throw new Error(
      `Missing API key for provider ${args.judge.provider}. Expected key name: ${apiKeyName}`
    );
  }

  const prompt = buildPrompt({
    rubric: args.rubric,
    notes: args.notes,
    resumeText: args.resume.text
  });

  const rawResponse = await callWithRepair({
    judge: args.judge,
    apiKey,
    prompt
  });

  const parsed = judgeOutputSchema.parse(tryParseJson(rawResponse));

  const warnings = [...args.resume.warnings];
  const criterionScores: Record<string, number> = {};
  const criterionRationales: Record<string, string> = {};
  let finalScore = 0;

  for (const criterion of args.rubric.criteria) {
    const modelScore = parsed.scores[criterion.criterionId];

    if (!modelScore) {
      warnings.push(`Missing score for criterion_id=${criterion.criterionId}; defaulted to 0.`);
      criterionScores[criterion.criterionId] = 0;
      criterionRationales[criterion.criterionId] = '';
      continue;
    }

    const numericScore = Number(modelScore.score);
    if (!Number.isFinite(numericScore)) {
      warnings.push(`Invalid score for criterion_id=${criterion.criterionId}; defaulted to 0.`);
      criterionScores[criterion.criterionId] = 0;
      criterionRationales[criterion.criterionId] = modelScore.rationale || '';
      continue;
    }

    const boundedScore = clamp(numericScore, 0, criterion.maxPoints);
    if (boundedScore !== numericScore) {
      warnings.push(`Out-of-range score for criterion_id=${criterion.criterionId}; clamped to valid bounds.`);
    }

    criterionScores[criterion.criterionId] = boundedScore;
    criterionRationales[criterion.criterionId] = modelScore.rationale || '';
    finalScore += boundedScore * criterion.weight;
  }

  finalScore = clamp(finalScore, 0, args.rubric.totalMax);

  return {
    judge: args.judge,
    applicantName: args.resume.applicantName,
    resumeFilename: args.resume.resumeFilename,
    criterionScores,
    criterionRationales,
    overallRationale: parsed.overall_rationale,
    finalScore,
    warnings
  };
}
