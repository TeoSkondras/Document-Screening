import { promises as fs } from 'fs';
import path from 'path';

const TEMP_ROOT = path.join('/tmp', 'resume-judge');

export interface JobDirectories {
  rootDir: string;
  uploadsDir: string;
  extractedDir: string;
  outputPath: string;
}

export function getJobDirectories(jobId: string): JobDirectories {
  const rootDir = path.join(TEMP_ROOT, jobId);
  const uploadsDir = path.join(rootDir, 'uploads');
  const extractedDir = path.join(rootDir, 'extracted');
  const outputPath = path.join(rootDir, 'results.xlsx');

  return { rootDir, uploadsDir, extractedDir, outputPath };
}

export async function ensureJobDirectories(jobId: string): Promise<JobDirectories> {
  const dirs = getJobDirectories(jobId);
  await fs.mkdir(dirs.uploadsDir, { recursive: true });
  await fs.mkdir(dirs.extractedDir, { recursive: true });
  return dirs;
}

export async function saveFileFromFormData(file: File, targetPath: string): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, Buffer.from(arrayBuffer));
}

export async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
