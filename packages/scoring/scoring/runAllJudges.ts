import type { JudgeSpec, ResumeText, Rubric, RunAllJudgesResult } from '@shared/types';

import { runJudgeOnResume } from './runJudgeOnResume';

export async function runAllJudges(args: {
  resumes: ResumeText[];
  rubric: Rubric;
  notes?: string;
  judges: JudgeSpec[];
  apiKeys: Partial<Record<string, string>>;
  onEvaluation?: (update: {
    done: number;
    total: number;
    judge: JudgeSpec;
    resume: ResumeText;
  }) => Promise<void> | void;
}): Promise<RunAllJudgesResult> {
  const { resumes, rubric, notes, judges, apiKeys, onEvaluation } = args;
  const byJudge: RunAllJudgesResult['byJudge'] = [];

  let done = 0;
  const total = resumes.length * judges.length;

  for (const judge of judges) {
    const judgeResults = [];

    for (const resume of resumes) {
      const result = await runJudgeOnResume({
        judge,
        rubric,
        notes,
        resume,
        apiKeys
      });

      judgeResults.push(result);

      done += 1;
      await onEvaluation?.({
        done,
        total,
        judge,
        resume
      });
    }

    byJudge.push({
      judge,
      results: judgeResults
    });
  }

  return { byJudge };
}
