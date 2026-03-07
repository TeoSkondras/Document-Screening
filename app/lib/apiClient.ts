import type { JudgeSpec, JobStatusResponse } from '@shared/types';

export interface SubmitJobOptions {
  resumesZip: File;
  rubricXlsx: File;
  notes?: string;
  judges: JudgeSpec[];
  apiKeys: Record<string, string>;
}

export interface SubmitJobResult {
  jobId: string;
  requiredKeys: string[];
}

export async function submitJob(opts: SubmitJobOptions): Promise<SubmitJobResult> {
  const form = new FormData();
  form.append('resumesZip', opts.resumesZip);
  form.append('rubricXlsx', opts.rubricXlsx);
  if (opts.notes) form.append('notes', opts.notes);
  form.append('judges', JSON.stringify(opts.judges));
  form.append('apiKeys', JSON.stringify(opts.apiKeys));

  const res = await fetch('/api/jobs', { method: 'POST', body: form });
  const data = await res.json() as { jobId?: string; requiredKeys?: string[]; error?: { message: string } };

  if (!res.ok) {
    const err = data?.error?.message ?? 'Failed to submit job.';
    throw Object.assign(new Error(err), { requiredKeys: data?.requiredKeys ?? [] });
  }

  return { jobId: data.jobId!, requiredKeys: data.requiredKeys ?? [] };
}

export async function pollJob(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) throw new Error('Failed to poll job status.');
  return res.json() as Promise<JobStatusResponse>;
}
