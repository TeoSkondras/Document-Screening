import { NextResponse } from 'next/server';

import {
  STATUS_RATE_LIMIT_MAX,
  STATUS_RATE_LIMIT_WINDOW_SECONDS
} from '@shared/constants';
import { getJobAccessTokenFromRequest, getRequestIp, isRateLimited, isUuid } from '@shared/security';

import { getJobStatus, getRedisConnection, hasJobAccess } from '@queue/queue';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  if (!isUuid(jobId)) {
    return NextResponse.json({ error: { message: 'Invalid job id.' } }, { status: 400 });
  }

  const accessToken = getJobAccessTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json({ error: { message: 'Job not found.' } }, { status: 404 });
  }

  const redis = getRedisConnection();
  const rateLimited = await isRateLimited({
    redis,
    bucket: 'status',
    identifier: `${getRequestIp(request)}:${jobId}`,
    limit: STATUS_RATE_LIMIT_MAX,
    windowSeconds: STATUS_RATE_LIMIT_WINDOW_SECONDS
  });

  if (rateLimited) {
    return NextResponse.json({ error: { message: 'Too many status requests.' } }, { status: 429 });
  }

  if (!(await hasJobAccess(jobId, accessToken))) {
    return NextResponse.json({ error: { message: 'Job not found.' } }, { status: 404 });
  }

  const jobStatus = await getJobStatus(jobId);

  if (!jobStatus) {
    return NextResponse.json({ error: { message: 'Job not found.' } }, { status: 404 });
  }

  return NextResponse.json(
    {
      jobId: jobStatus.jobId,
      status: jobStatus.status,
      progress: jobStatus.progress,
      result: jobStatus.result,
      error: jobStatus.error
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  );
}
