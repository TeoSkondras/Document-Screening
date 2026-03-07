'use client';

import { useEffect, useRef } from 'react';
import type { JobStatusResponse } from '@shared/types';
import { Loader2 } from 'lucide-react';
import { pollJob } from '../lib/apiClient';
import { Progress } from '@/app/components/ui/progress';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/lib/utils';

interface Props {
  jobId: string;
  onResult: (result: JobStatusResponse) => void;
  latestResult: JobStatusResponse | null;
}

const PHASE_LABELS: Record<string, string> = {
  extract: 'Extracting text',
  judge:   'Judging resumes',
  excel:   'Building results',
  upload:  'Finalizing',
};

export default function ProgressPanel({ jobId, onResult, latestResult }: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const terminal = latestResult?.status === 'succeeded' || latestResult?.status === 'failed';
    if (terminal) return;

    async function poll() {
      try {
        const result = await pollJob(jobId);
        onResultRef.current(result);
        if (result.status === 'succeeded' || result.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // ignore transient poll errors
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [jobId, latestResult?.status]);

  const status = latestResult?.status ?? 'queued';
  const progress = latestResult?.progress;
  const pct = progress?.pct ?? 0;
  const isRunning = status === 'running' || status === 'queued';

  type BadgeVariant = 'queued' | 'running' | 'succeeded' | 'failed';
  const badgeVariant = (status as BadgeVariant) in { queued: 1, running: 1, succeeded: 1, failed: 1 }
    ? (status as BadgeVariant)
    : 'queued';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant={badgeVariant}>{status.toUpperCase()}</Badge>
        {isRunning && <Loader2 className="h-4 w-4 text-plum animate-spin" />}
        {progress?.phase && (
          <span className="text-sm text-ink">
            {PHASE_LABELS[progress.phase] ?? progress.phase}
          </span>
        )}
      </div>

      <Progress
        value={Math.max(4, pct)}
        className={cn(status === 'failed' && '[&>div]:bg-red-500')}
      />

      {progress?.message && (
        <p className="text-sm text-mauve">{progress.message}</p>
      )}

      {latestResult?.error && (
        <div className="mt-2 px-4 py-3 rounded-lg border border-rose bg-rose/10 text-sm text-red-700">
          {latestResult.error.message}
        </div>
      )}
    </div>
  );
}
