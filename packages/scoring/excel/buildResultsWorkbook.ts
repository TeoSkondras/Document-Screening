import ExcelJS from 'exceljs';

import type { ResumeJudgeResult, Rubric, RunAllJudgesResult } from '@shared/types';

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*:[\]]/g, '-').trim();
  return cleaned.slice(0, 31) || 'Sheet';
}

function makeUniqueSheetName(name: string, used: Set<string>): string {
  let candidate = sanitizeSheetName(name);
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }

  let i = 2;
  while (true) {
    const suffix = `-${i}`;
    const base = candidate.slice(0, Math.max(1, 31 - suffix.length));
    const next = `${base}${suffix}`;

    if (!used.has(next)) {
      used.add(next);
      return next;
    }

    i += 1;
  }
}

function sortByFinalScoreDesc<T extends { finalScore: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.finalScore - a.finalScore);
}

function addJudgeSheet(args: {
  workbook: ExcelJS.Workbook;
  sheetName: string;
  rubric: Rubric;
  rows: ResumeJudgeResult[];
}): void {
  const { workbook, sheetName, rubric, rows } = args;
  const sheet = workbook.addWorksheet(sheetName);

  const headers = [
    'ApplicantName',
    'ResumeFilename',
    ...rubric.criteria.map((c) => `${c.criterion} (${c.criterionId})`),
    'FinalScore'
  ];

  sheet.addRow(headers);

  for (const row of sortByFinalScoreDesc(rows)) {
    const values = [
      row.applicantName,
      row.resumeFilename,
      ...rubric.criteria.map((c) => row.criterionScores[c.criterionId] ?? 0),
      row.finalScore
    ];
    sheet.addRow(values);
  }

  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column, index) => {
    if (index <= 1) {
      column.width = 28;
    } else {
      column.width = 18;
      column.numFmt = '0.00';
    }
  });
}

function buildAverageRows(args: {
  results: RunAllJudgesResult;
  rubric: Rubric;
}): ResumeJudgeResult[] {
  const accumulator = new Map<
    string,
    {
      applicantName: string;
      resumeFilename: string;
      criterionSums: Record<string, number>;
      finalSum: number;
      count: number;
    }
  >();

  for (const judgeGroup of args.results.byJudge) {
    for (const row of judgeGroup.results) {
      const key = `${row.applicantName}::${row.resumeFilename}`;
      const existing = accumulator.get(key) ?? {
        applicantName: row.applicantName,
        resumeFilename: row.resumeFilename,
        criterionSums: {},
        finalSum: 0,
        count: 0
      };

      for (const criterion of args.rubric.criteria) {
        existing.criterionSums[criterion.criterionId] =
          (existing.criterionSums[criterion.criterionId] ?? 0) +
          (row.criterionScores[criterion.criterionId] ?? 0);
      }

      existing.finalSum += row.finalScore;
      existing.count += 1;

      accumulator.set(key, existing);
    }
  }

  const avgRows: ResumeJudgeResult[] = [];

  for (const entry of accumulator.values()) {
    const criterionScores: Record<string, number> = {};

    for (const criterion of args.rubric.criteria) {
      criterionScores[criterion.criterionId] =
        (entry.criterionSums[criterion.criterionId] ?? 0) / entry.count;
    }

    avgRows.push({
      judge: { provider: 'openai', model: 'average' },
      applicantName: entry.applicantName,
      resumeFilename: entry.resumeFilename,
      criterionScores,
      criterionRationales: {},
      overallRationale: 'Average across judges',
      finalScore: entry.finalSum / entry.count,
      warnings: []
    });
  }

  return avgRows;
}

export async function buildResultsWorkbook(args: {
  results: RunAllJudgesResult;
  rubric: Rubric;
  outputPath: string;
}): Promise<void> {
  const { results, rubric, outputPath } = args;

  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();

  for (const judgeGroup of results.byJudge) {
    const rawName = `${judgeGroup.judge.provider}-${judgeGroup.judge.model}`;
    const sheetName = makeUniqueSheetName(rawName, usedSheetNames);

    addJudgeSheet({
      workbook,
      sheetName,
      rubric,
      rows: judgeGroup.results
    });
  }

  if (results.byJudge.length > 1) {
    const averageRows = buildAverageRows({ results, rubric });
    const sheetName = makeUniqueSheetName('Average', usedSheetNames);

    addJudgeSheet({
      workbook,
      sheetName,
      rubric,
      rows: averageRows
    });
  }

  await workbook.xlsx.writeFile(outputPath);
}
