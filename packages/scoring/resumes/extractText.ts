import { promises as fs } from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

import type { ResumeText } from '@shared/types';

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

export interface ResumeExtractionWarning {
  file: string;
  message: string;
}

export interface ExtractResumesResult {
  resumes: ResumeText[];
  warnings: ResumeExtractionWarning[];
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractFromPdf(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  return normalizeWhitespace(parsed.text || '');
}

async function extractFromDocx(filePath: string): Promise<string> {
  const parsed = await mammoth.extractRawText({ path: filePath });
  return normalizeWhitespace(parsed.value || '');
}

async function extractFromTxt(filePath: string): Promise<string> {
  const text = await fs.readFile(filePath, 'utf8');
  return normalizeWhitespace(text);
}

export async function extractTextFromResume(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    return extractFromPdf(filePath);
  }

  if (ext === '.docx') {
    return extractFromDocx(filePath);
  }

  if (ext === '.txt') {
    return extractFromTxt(filePath);
  }

  throw new Error(`Unsupported resume extension: ${ext || '(none)'}`);
}

export async function extractTextFromResumeFiles(
  filePaths: string[],
  onEachFile?: (args: { done: number; total: number; filePath: string }) => Promise<void> | void
): Promise<ExtractResumesResult> {
  const resumes: ResumeText[] = [];
  const warnings: ResumeExtractionWarning[] = [];
  let done = 0;

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      warnings.push({
        file: path.basename(filePath),
        message: `Skipped unsupported file type: ${ext || '(none)'}`
      });
      done += 1;
      await onEachFile?.({ done, total: filePaths.length, filePath });
      continue;
    }

    try {
      const text = await extractTextFromResume(filePath);
      const fileName = path.basename(filePath);

      resumes.push({
        applicantName: path.basename(fileName, path.extname(fileName)),
        resumeFilename: fileName,
        sourcePath: filePath,
        text,
        warnings:
          text.length > 0
            ? []
            : ['Extracted text was empty; scoring may be unreliable for this resume.']
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown extraction error';
      warnings.push({
        file: path.basename(filePath),
        message
      });
    }

    done += 1;
    await onEachFile?.({ done, total: filePaths.length, filePath });
  }

  return { resumes, warnings };
}
