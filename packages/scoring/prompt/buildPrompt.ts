import { JUDGE_JSON_SCHEMA_HINT, PROMPT_TEMPLATE } from '@shared/constants';
import type { Rubric } from '@shared/types';

function formatRubricTable(rubric: Rubric): string {
  const rows = rubric.criteria.map((criterion) => ({
    criterion_id: criterion.criterionId,
    criterion: criterion.criterion,
    description: criterion.description,
    max_points: criterion.maxPoints,
    weight: criterion.weight
  }));

  return JSON.stringify(rows, null, 2);
}

export function buildPrompt(args: {
  rubric: Rubric;
  notes?: string;
  resumeText: string;
}): string {
  const { rubric, notes, resumeText } = args;

  const instructions = PROMPT_TEMPLATE.replace('{{SCHEMA_HINT}}', JUDGE_JSON_SCHEMA_HINT);

  return `${instructions}
Rubric (JSON array):
${formatRubricTable(rubric)}

Extra notes from recruiter:
${notes?.trim() ? notes : '(none)'}

Resume text:
${resumeText}
`;
}

export function buildRepairPrompt(args: {
  originalPrompt: string;
  previousResponse: string;
}): string {
  return `Your previous response was invalid JSON.

Return ONLY valid JSON matching this exact schema:
${JUDGE_JSON_SCHEMA_HINT}

Do not include markdown or extra keys.

Use the same rubric criteria and resume context from this original prompt:
${args.originalPrompt}

Previous response:
${args.previousResponse}`;
}
