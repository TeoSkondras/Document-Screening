import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import unzipper from 'unzipper';

function sanitizeZipPath(entryPath: string): string {
  return path
    .normalize(entryPath)
    .replace(/^([/\\])+/, '')
    .replace(/^(\.\.(?:[/\\]|$))+/, '');
}

async function listFilesRecursive(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function unzipResumes(zipPath: string, outputDir: string): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });

  const archive = await unzipper.Open.file(zipPath);

  for (const file of archive.files) {
    if (file.type === 'Directory') {
      continue;
    }

    const safeRelativePath = sanitizeZipPath(file.path);
    if (!safeRelativePath) {
      continue;
    }

    const targetPath = path.join(outputDir, safeRelativePath);
    const normalizedOutputDir = path.resolve(outputDir) + path.sep;
    const normalizedTargetPath = path.resolve(targetPath);

    if (!normalizedTargetPath.startsWith(normalizedOutputDir)) {
      continue;
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await pipeline(file.stream(), createWriteStream(targetPath));
  }

  return listFilesRecursive(outputDir);
}
