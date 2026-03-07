import { Download } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface Props {
  jobId: string;
}

export default function ResultDownload({ jobId }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <p className="text-sm font-medium text-ink">Scoring complete!</p>
      <Button asChild size="lg">
        <a href={`/api/jobs/${jobId}/download`} download>
          <Download className="h-4 w-4" />
          Download Results (XLSX)
        </a>
      </Button>
      <p className="text-xs text-mauve">
        If multiple judges were used, an Average sheet is included.
      </p>
    </div>
  );
}
