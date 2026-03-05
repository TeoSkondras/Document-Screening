import { randomUUID } from 'crypto';
import path from 'path';

import { NextResponse } from 'next/server';

import { PROVIDER_ENV_KEY } from '@shared/constants';
import { apiKeysSchema, judgesSchema } from '@shared/schemas';
import type { CreateJobPayload } from '@shared/types';

import { getQueue, initJobStatus } from '@queue/queue';
import { ensureJobDirectories, saveFileFromFormData } from '@storage/localTempStorage';

export const runtime = 'nodejs';

function parseJsonField<T>(label: string, value: FormDataEntryValue | null): T {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a JSON string.`);
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const resumesZip = formData.get('resumesZip');
    const rubricXlsx = formData.get('rubricXlsx');
    const notes = formData.get('notes');
    const judgesRaw = formData.get('judges');
    const apiKeysRaw = formData.get('apiKeys');

    if (!(resumesZip instanceof File)) {
      return NextResponse.json({ error: { message: 'resumesZip file is required.' } }, { status: 400 });
    }

    if (!(rubricXlsx instanceof File)) {
      return NextResponse.json({ error: { message: 'rubricXlsx file is required.' } }, { status: 400 });
    }

    const judgesParsed = parseJsonField<unknown>('judges', judgesRaw);
    const judges = judgesSchema.parse(judgesParsed);

    const providedApiKeys = apiKeysRaw
      ? apiKeysSchema.parse(parseJsonField<unknown>('apiKeys', apiKeysRaw))
      : {};

    const requiredKeys = Array.from(
      new Set(judges.map((judge) => PROVIDER_ENV_KEY[judge.provider]))
    );

    const resolvedApiKeys: Partial<Record<string, string>> = {};
    const missingKeys: string[] = [];

    for (const keyName of requiredKeys) {
      const value = providedApiKeys[keyName] || process.env[keyName];
      if (value) {
        resolvedApiKeys[keyName] = value;
      } else {
        missingKeys.push(keyName);
      }
    }

    if (missingKeys.length > 0) {
      return NextResponse.json(
        {
          error: {
            message: `Missing required API key(s): ${missingKeys.join(', ')}`
          },
          requiredKeys
        },
        { status: 400 }
      );
    }

    const jobId = randomUUID();
    const dirs = await ensureJobDirectories(jobId);
    const resumesZipPath = path.join(dirs.uploadsDir, 'resumes.zip');
    const rubricXlsxPath = path.join(dirs.uploadsDir, 'rubric.xlsx');

    await saveFileFromFormData(resumesZip, resumesZipPath);
    await saveFileFromFormData(rubricXlsx, rubricXlsxPath);

    await initJobStatus(jobId);

    const payload: CreateJobPayload = {
      jobId,
      resumesZipPath,
      rubricXlsxPath,
      notes: typeof notes === 'string' ? notes : undefined,
      judges,
      apiKeys: resolvedApiKeys
    };

    await getQueue().add(jobId, payload, {
      jobId,
      attempts: 1
    });

    return NextResponse.json({
      jobId,
      requiredKeys
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job.';
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
