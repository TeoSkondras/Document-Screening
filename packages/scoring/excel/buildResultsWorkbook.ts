import ExcelJS from 'exceljs';

import type { ResumeJudgeResult, Rubric, RunAllJudgesResult } from '@shared/types';

type CellFill = NonNullable<ExcelJS.Fill>;

interface SheetRowData {
  result: ResumeJudgeResult;
  includeDefaultNotes?: boolean;
  cellNotes?: Record<string, string>;
  cellFills?: Record<string, CellFill>;
}

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
  rows: SheetRowData[];
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

  const sortedRows = [...rows].sort((a, b) => b.result.finalScore - a.result.finalScore);

  for (const rowData of sortedRows) {
    const row = rowData.result;
    const values = [
      row.applicantName,
      row.resumeFilename,
      ...rubric.criteria.map((c) => row.criterionScores[c.criterionId] ?? 0),
      row.finalScore
    ];
    const addedRow = sheet.addRow(values);

    rubric.criteria.forEach((criterion, index) => {
      const columnIndex = index + 3;
      const cell = addedRow.getCell(columnIndex);
      const note =
        rowData.cellNotes?.[criterion.criterionId] ??
        (rowData.includeDefaultNotes === false ? undefined : row.criterionRationales[criterion.criterionId]);
      const fill = rowData.cellFills?.[criterion.criterionId];

      if (note?.trim()) {
        cell.note = note.trim();
      }

      if (fill) {
        cell.fill = fill;
      }
    });

    const finalScoreCell = addedRow.getCell(rubric.criteria.length + 3);
    const finalScoreNote =
      rowData.cellNotes?.finalScore ??
      (rowData.includeDefaultNotes === false ? undefined : row.overallRationale);
    const finalScoreFill = rowData.cellFills?.finalScore;

    if (finalScoreNote?.trim()) {
      finalScoreCell.note = finalScoreNote.trim();
    }

    if (finalScoreFill) {
      finalScoreCell.fill = finalScoreFill;
    }
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

function discrepancyFill(scoreRange: number): CellFill | undefined {
  if (scoreRange >= 4) {
    return {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC7CE' }
    };
  }

  if (scoreRange >= 2) {
    return {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEB9C' }
    };
  }

  return undefined;
}

function buildAverageRows(args: {
  results: RunAllJudgesResult;
  rubric: Rubric;
}): SheetRowData[] {
  const accumulator = new Map<
    string,
    {
      applicantName: string;
      resumeFilename: string;
      criterionSums: Record<string, number>;
      criterionScoresByJudge: Record<string, Array<{ judgeLabel: string; score: number; rationale: string }>>;
      finalSum: number;
      finalScoresByJudge: Array<{ judgeLabel: string; score: number; rationale: string }>;
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
        criterionScoresByJudge: {},
        finalSum: 0,
        finalScoresByJudge: [],
        count: 0
      };
      const judgeLabel = `${judgeGroup.judge.provider}/${judgeGroup.judge.model}`;

      for (const criterion of args.rubric.criteria) {
        const score = row.criterionScores[criterion.criterionId] ?? 0;
        existing.criterionSums[criterion.criterionId] =
          (existing.criterionSums[criterion.criterionId] ?? 0) +
          score;
        const criterionRows = existing.criterionScoresByJudge[criterion.criterionId] ?? [];
        criterionRows.push({
          judgeLabel,
          score,
          rationale: row.criterionRationales[criterion.criterionId] ?? ''
        });
        existing.criterionScoresByJudge[criterion.criterionId] = criterionRows;
      }

      existing.finalSum += row.finalScore;
      existing.finalScoresByJudge.push({
        judgeLabel,
        score: row.finalScore,
        rationale: row.overallRationale ?? ''
      });
      existing.count += 1;

      accumulator.set(key, existing);
    }
  }

  const avgRows: SheetRowData[] = [];

  for (const entry of accumulator.values()) {
    const criterionScores: Record<string, number> = {};
    const cellFills: Record<string, CellFill> = {};

    for (const criterion of args.rubric.criteria) {
      const criterionJudgeScores = entry.criterionScoresByJudge[criterion.criterionId] ?? [];
      criterionScores[criterion.criterionId] =
        (entry.criterionSums[criterion.criterionId] ?? 0) / entry.count;
      const scores = criterionJudgeScores.map((item) => item.score);
      const scoreRange = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;
      const fill = discrepancyFill(scoreRange);

      if (fill) {
        cellFills[criterion.criterionId] = fill;
      }
    }

    const finalScore = entry.finalSum / entry.count;

    avgRows.push({
      result: {
        judge: { provider: 'openai', model: 'average' },
        applicantName: entry.applicantName,
        resumeFilename: entry.resumeFilename,
        criterionScores,
        criterionRationales: {},
        overallRationale: 'Average across judges',
        finalScore,
        warnings: []
      },
      includeDefaultNotes: false,
      cellFills
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
      rows: judgeGroup.results.map((result) => ({ result }))
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
