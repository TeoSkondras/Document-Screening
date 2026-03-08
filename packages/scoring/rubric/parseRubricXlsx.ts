import ExcelJS from 'exceljs';

import { MAX_RUBRIC_CRITERIA } from '@shared/constants';
import { rubricRowSchema } from '@shared/schemas';
import type { Rubric, RubricCriterion } from '@shared/types';

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function toCellString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    if ('text' in value && typeof (value as { text?: unknown }).text === 'string') {
      return ((value as { text: string }).text || '').trim();
    }

    if ('result' in value && typeof (value as { result?: unknown }).result === 'number') {
      return String((value as { result: number }).result);
    }
  }

  return '';
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = toCellString(value);
  if (!text) {
    return Number.NaN;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'criterion';
}

function buildCriterionId(rawCriterion: string, index: number, used: Set<string>): string {
  const base = slugify(rawCriterion);
  let candidate = `${base}-${index + 1}`;

  while (used.has(candidate)) {
    candidate = `${candidate}-dup`;
  }

  used.add(candidate);
  return candidate;
}

export async function parseRubricXlsx(filePath: string): Promise<Rubric> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet =
    workbook.worksheets.find((ws) => ws.name.trim().toLowerCase() === 'rubric') ??
    workbook.worksheets[0];

  if (!sheet) {
    throw new Error('Rubric workbook has no sheets.');
  }

  const headerRow = sheet.getRow(1);
  const headerMap = new Map<string, number>();

  headerRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(toCellString(cell.value));
    if (normalized) {
      headerMap.set(normalized, colNumber);
    }
  });

  const criterionCol = headerMap.get('criterion');
  const descriptionCol = headerMap.get('description');
  const maxPointsCol = headerMap.get('max_points');
  const weightCol = headerMap.get('weight');

  if (!criterionCol || !maxPointsCol) {
    throw new Error(
      'Rubric sheet must include case-insensitive columns: criterion and max_points.'
    );
  }

  const criteria: RubricCriterion[] = [];
  const usedIds = new Set<string>();

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const criterion = toCellString(row.getCell(criterionCol).value);

    if (!criterion) {
      continue;
    }

    const rawDescription = descriptionCol ? toCellString(row.getCell(descriptionCol).value) : '';
    const rawWeight = weightCol ? toNumber(row.getCell(weightCol).value) : Number.NaN;

    const parsedRow = rubricRowSchema.parse({
      criterion,
      description: rawDescription || undefined,
      max_points: toNumber(row.getCell(maxPointsCol).value),
      weight: Number.isFinite(rawWeight) ? rawWeight : undefined
    });

    const criterionId = buildCriterionId(parsedRow.criterion, criteria.length, usedIds);

    if (criteria.length >= MAX_RUBRIC_CRITERIA) {
      throw new Error(`Rubric exceeds the maximum of ${MAX_RUBRIC_CRITERIA} criteria.`);
    }

    criteria.push({
      criterionId,
      criterion: parsedRow.criterion,
      description: parsedRow.description ?? '',
      maxPoints: parsedRow.max_points,
      weight: parsedRow.weight ?? 1
    });
  }

  if (!criteria.length) {
    throw new Error('Rubric sheet contains no valid criterion rows.');
  }

  const totalMax = criteria.reduce((sum, c) => sum + c.maxPoints * c.weight, 0);

  return {
    criteria,
    totalMax
  };
}
