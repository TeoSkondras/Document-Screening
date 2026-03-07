'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';

interface Props {
  requiredKeys: string[];
  onConfirm: (keys: Record<string, string>) => void;
  onCancel: () => void;
}

export default function ApiKeyModal({ requiredKeys, onConfirm, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(requiredKeys.map(k => [k, '']))
  );

  const allFilled = requiredKeys.every(k => values[k]?.trim());

  function handleConfirm() {
    if (!allFilled) return;
    onConfirm(Object.fromEntries(requiredKeys.map(k => [k, values[k].trim()])));
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API Keys Required</DialogTitle>
          <DialogDescription>
            Enter keys for the providers in use. Keys are sent directly to the server and never stored.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {requiredKeys.map(key => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`key-${key}`}>{key}</Label>
              <Input
                id={`key-${key}`}
                type="password"
                value={values[key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                placeholder={`Enter ${key}`}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!allFilled}>
            Confirm &amp; Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
