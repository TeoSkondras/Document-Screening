'use client';

import type { Provider } from '@shared/types';
import { X, Plus } from 'lucide-react';
import { SUGGESTED_MODELS } from '../lib/suggestedModels';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

export interface JudgeEntry {
  id: string;
  provider: Provider;
  model: string;
}

interface Props {
  judges: JudgeEntry[];
  onChange: (judges: JudgeEntry[]) => void;
  disabled?: boolean;
}

export default function JudgeSelector({ judges, onChange, disabled }: Props) {
  function addJudge() {
    onChange([...judges, { id: crypto.randomUUID(), provider: 'openai', model: '' }]);
  }

  function removeJudge(id: string) {
    if (judges.length <= 1) return;
    onChange(judges.filter(j => j.id !== id));
  }

  function updateJudge(id: string, patch: Partial<Omit<JudgeEntry, 'id'>>) {
    onChange(judges.map(j => j.id === id ? { ...j, ...patch } : j));
  }

  return (
    <div className="space-y-3">
      {judges.map((judge, i) => (
        <div key={judge.id} className="flex items-center gap-2">
          <span className="min-w-[20px] text-sm text-mauve">{i + 1}.</span>
          <Select
            value={judge.provider}
            disabled={disabled}
            onValueChange={(val) => updateJudge(judge.id, { provider: val as Provider, model: '' })}
          >
            <SelectTrigger className="w-36 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1 relative">
            <Input
              type="text"
              list={`models-${judge.id}`}
              value={judge.model}
              disabled={disabled}
              placeholder="Model name (e.g. gpt-5.4)"
              onChange={e => updateJudge(judge.id, { model: e.target.value })}
            />
            <datalist id={`models-${judge.id}`}>
              {(SUGGESTED_MODELS[judge.provider] ?? []).map(m => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeJudge(judge.id)}
            disabled={disabled || judges.length <= 1}
            title="Remove judge"
            className="text-mauve hover:text-red-500 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <button
        type="button"
        onClick={addJudge}
        disabled={disabled}
        className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[var(--border)] text-sm text-mauve hover:border-plum hover:text-plum transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="h-4 w-4" /> Add Judge
      </button>
    </div>
  );
}
