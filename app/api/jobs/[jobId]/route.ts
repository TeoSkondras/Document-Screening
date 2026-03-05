import { NextResponse } from 'next/server';

import { getJobStatus } from '@queue/queue';

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

  return NextResponse.json({
    jobId: jobStatus.jobId,
    status: jobStatus.status,
    progress: jobStatus.progress,
    result: jobStatus.result,
    error: jobStatus.error
  });
}
