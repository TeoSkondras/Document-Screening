import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { JOB_QUEUE_NAME, JOB_REDIS_KEY_PREFIX } from '@shared/constants';
import type {
  CreateJobPayload,
  JobError,
  JobProgress,
  JobStatus,
  JobStatusResponse
} from '@shared/types';

let redisClient: IORedis | null = null;
let queueInstance: Queue | null = null;

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required to run queue and job status APIs.');
  }
  return redisUrl;
}

export function getRedisConnection(): IORedis {
  if (!redisClient) {
    redisClient = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null
    });
  }

  return redisClient;
}

export function getQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(JOB_QUEUE_NAME, {
      connection: getRedisConnection() as never,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 100
      }
    });
  }

  return queueInstance;
}

function jobKey(jobId: string): string {
  return `${JOB_REDIS_KEY_PREFIX}${jobId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizePct(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export async function initJobStatus(jobId: string): Promise<void> {
  const redis = getRedisConnection();
  const progress: JobProgress = {
    phase: 'extract',
    pct: 0,
    message: 'Queued'
  };

  await redis.hset(jobKey(jobId), {
    jobId,
    status: 'queued',
    progress_phase: progress.phase,
    progress_pct: String(progress.pct),
    progress_message: progress.message,
    result_path: '',
    error_message: '',
    error_stack: '',
    created_at: nowIso(),
    updated_at: nowIso()
  });
}

export async function setJobStatus(args: {
  jobId: string;
  status?: JobStatus;
  progress?: JobProgress;
  resultPath?: string;
  error?: JobError | null;
}): Promise<void> {
  const redis = getRedisConnection();
  const updates: Record<string, string> = {
    updated_at: nowIso()
  };

  if (args.status) {
    updates.status = args.status;
  }

  if (args.progress) {
    updates.progress_phase = args.progress.phase;
    updates.progress_pct = String(normalizePct(args.progress.pct));
    updates.progress_message = args.progress.message;
  }

  if (typeof args.resultPath === 'string') {
    updates.result_path = args.resultPath;
  }

  if (args.error === null) {
    updates.error_message = '';
    updates.error_stack = '';
  }

  if (args.error) {
    updates.error_message = args.error.message;
    updates.error_stack = args.error.stack ?? '';
  }

  await redis.hset(jobKey(args.jobId), updates);
}

export async function getJobStatus(jobId: string): Promise<(JobStatusResponse & { resultPath?: string }) | null> {
  const redis = getRedisConnection();
  const raw = await redis.hgetall(jobKey(jobId));

  if (!raw || Object.keys(raw).length === 0) {
    return null;
  }

  const pct = Number(raw.progress_pct ?? 0);
  const resultPath = raw.result_path || undefined;

  return {
    jobId,
    status: (raw.status as JobStatus) ?? 'queued',
    progress: {
      phase: (raw.progress_phase as JobProgress['phase']) ?? 'extract',
      pct: normalizePct(pct),
      message: raw.progress_message ?? ''
    },
    result: resultPath ? { downloadUrl: `/api/jobs/${jobId}/download` } : null,
    error: raw.error_message
      ? {
          message: raw.error_message,
          stack: raw.error_stack || undefined
        }
      : null,
    resultPath
  };
}
