# Resume LLM Judge (Backend)

Production-oriented, one-day build backend for scoring resume batches with multiple LLM judges.

- Next.js App Router API (thin handlers)
- BullMQ + Redis background processing
- `/tmp` local temp storage for uploads/results
- Excel output with one sheet per judge (+ `Average` when multiple judges)

## Folder Structure

```text
app/api
  jobs/
    route.ts
    [jobId]/route.ts
    [jobId]/download/route.ts

packages/
  shared/
    types.ts
    schemas.ts
    constants.ts
  scoring/
    rubric/parseRubricXlsx.ts
    resumes/unzipResumes.ts
    resumes/extractText.ts
    prompt/buildPrompt.ts
    judges/base.ts
    judges/openai.ts
    judges/anthropic.ts
    judges/gemini.ts
    scoring/runJudgeOnResume.ts
    scoring/runAllJudges.ts
    excel/buildResultsWorkbook.ts
  queue/
    queue.ts
    worker.ts
  storage/
    localTempStorage.ts
```

## Requirements

- Node.js 20+
- Redis (local or Railway)

## Environment

Create `.env` (or use Railway vars):

```bash
REDIS_URL=redis://localhost:6379

# Optional fallback provider keys (can also be sent in POST /api/jobs apiKeys JSON)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Optional
WORKER_CONCURRENCY=2
```

Notes:
- API keys are only required for providers selected in the job.
- No key persistence on disk.
- Keys are not logged by this service.

## Install

```bash
npm install
```

## Run Locally

Terminal 1 (API):

```bash
npm run dev
```

Terminal 2 (worker):

```bash
npm run worker
```

## API Contract

### 1) `POST /api/jobs`

Multipart form-data fields:
- `resumesZip` (file, required)
- `rubricXlsx` (file, required)
- `notes` (string, optional)
- `judges` (stringified JSON array, required), e.g. `[{"provider":"openai","model":"gpt-5.2"}]`
- `apiKeys` (stringified JSON object, optional), e.g. `{"OPENAI_API_KEY":"..."}`

Response:

```json
{ "jobId": "<uuid>", "requiredKeys": ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"] }
```

### 2) `GET /api/jobs/:jobId`

Response:

```json
{
  "jobId": "<uuid>",
  "status": "queued|running|succeeded|failed",
  "progress": { "phase": "extract|judge|excel|upload", "pct": 0.0, "message": "..." },
  "result": { "downloadUrl": "/api/jobs/<uuid>/download" } | null,
  "error": { "message": "...", "stack": "..." } | null
}
```

### 3) `GET /api/jobs/:jobId/download`

Streams generated XLSX with content type:
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

## Example: Submit Job

```bash
curl -X POST http://localhost:3000/api/jobs \
  -F "resumesZip=@./samples/resumes.zip" \
  -F "rubricXlsx=@./samples/rubric.xlsx" \
  -F 'notes=Prioritize backend systems design and production ownership.' \
  -F 'judges=[{"provider":"openai","model":"gpt-5.2"},{"provider":"anthropic","model":"claude-sonnet-4-5"}]' \
  -F 'apiKeys={"OPENAI_API_KEY":"'$OPENAI_API_KEY'","ANTHROPIC_API_KEY":"'$ANTHROPIC_API_KEY'"}'
```

## Example: Poll Job

```bash
curl http://localhost:3000/api/jobs/<jobId>
```

## Example: Download Result

```bash
curl -L http://localhost:3000/api/jobs/<jobId>/download -o results.xlsx
```

## Scoring Pipeline

1. Upload saved under `/tmp/resume-judge/<jobId>/uploads`
2. Worker unzips resumes
3. Text extraction (`.pdf`, `.docx`, `.txt`; unsupported skipped with warnings)
4. Rubric parse from `Rubric` sheet if present, else first sheet
5. For each `resume x judge`:
   - prompt model with rubric + notes + resume text
   - require strict JSON output
   - retry once with repair prompt if invalid JSON
   - validate JSON with Zod
   - compute weighted final score server-side (bounded)
6. Build workbook:
   - one sheet per judge
   - columns: `ApplicantName`, `ResumeFilename`, each rubric criterion, `FinalScore`
   - rows sorted by `FinalScore` descending
   - add `Average` sheet if >1 judge
7. Save output to `/tmp/resume-judge/<jobId>/results.xlsx`

## Rubric XLSX Format

Case-insensitive columns expected:
- `criterion` (required)
- `description` (optional)
- `max_points` (required, > 0)
- `weight` (optional, default `1`)

Internal `criterion_id` is generated as a stable slug.

## Deployment Notes (Railway)

Single service pattern is supported:
- API process: `npm run start` (or `npm run dev` for non-prod)
- Worker process: `npm run worker`

Typical production setup uses two Railway process types from same service codebase (web + worker) sharing the same `REDIS_URL`.

## Scripts

- `npm run dev` - start Next.js dev server
- `npm run build` - build app
- `npm run start` - start production server
- `npm run worker` - start BullMQ worker
- `npm run typecheck` - TypeScript check
