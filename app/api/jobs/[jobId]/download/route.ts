import { createReadStream } from 'fs';
import { Readable } from 'stream';

import { NextResponse } from 'next/server';

import { getJobStatus } from '@queue/queue';
import { fileExists } from '@storage/localTempStorage';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const jobStatus = await getJobStatus(jobId);

  if (!jobStatus) {
    return NextResponse.json({ error: { message: 'Job not found.' } }, { status: 404 });
  }

  if (jobStatus.status !== 'succeeded' || !jobStatus.resultPath) {
    return NextResponse.json(
      { error: { message: 'Result is not ready for download.' } },
      { status: 409 }
    );
  }

  const exists = await fileExists(jobStatus.resultPath);
  if (!exists) {
    return NextResponse.json({ error: { message: 'Result file does not exist.' } }, { status: 404 });
  }

  const fileStream = createReadStream(jobStatus.resultPath);

  return new NextResponse(Readable.toWeb(fileStream) as ReadableStream, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="resume-judge-${jobId}.xlsx"`
    }
  });
}
