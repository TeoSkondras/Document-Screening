import * as React from 'react';
import { cn } from '@/app/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-ink shadow-sm placeholder:text-mauve/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 resize-vertical min-h-[80px]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
