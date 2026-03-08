import { promises as fs } from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

import {
  MAX_RESUME_TEXT_CHARS,
  MAX_SINGLE_EXTRACTED_FILE_BYTES,
  SUPPORTED_RESUME_EXTENSIONS
} from '@shared/constants';
import type { ResumeText } from '@shared/types';

const SUPPORTED_EXTENSIONS = new Set<string>(SUPPORTED_RESUME_EXTENSIONS);

export interface ResumeExtractionWarning {
  file: string;
  message: string;
}

export interface ExtractResumesResult {
  resumes: ResumeText[];
  warnings: ResumeExtractionWarning[];
}

interface ExtractedResumeText {
  text: string;
  truncated: boolean;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractFromPdf(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  return normalizeWhitespace(parsed.text || '');
}

async function extractFromTxt(filePath: string): Promise<string> {
  const text = await fs.readFile(filePath, 'utf8');
  return normalizeWhitespace(text);
}

function limitExtractedText(text: string): ExtractedResumeText {
  if (text.length <= MAX_RESUME_TEXT_CHARS) {
    return { text, truncated: false };
  }

  return {
    text: text.slice(0, MAX_RESUME_TEXT_CHARS),
    truncated: true
  };
}

export async function extractTextFromResume(filePath: string): Promise<ExtractedResumeText> {
  const stats = await fs.stat(filePath);
  if (stats.size > MAX_SINGLE_EXTRACTED_FILE_BYTES) {
    throw new Error('Resume file exceeds the maximum allowed size.');
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    return limitExtractedText(await extractFromPdf(filePath));
  }

  if (ext === '.txt') {
    return limitExtractedText(await extractFromTxt(filePath));
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
      const extracted = await extractTextFromResume(filePath);
      const fileName = path.basename(filePath);
      const warningsForResume =
        extracted.text.length > 0
          ? []
          : ['Extracted text was empty; scoring may be unreliable for this resume.'];

      if (extracted.truncated) {
        warningsForResume.push(
          `Resume text exceeded ${MAX_RESUME_TEXT_CHARS.toLocaleString()} characters and was truncated for safety.`
        );
      }

      resumes.push({
        applicantName: path.basename(fileName, path.extname(fileName)),
        resumeFilename: fileName,
        sourcePath: filePath,
        text: extracted.text,
        warnings: warningsForResume
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
