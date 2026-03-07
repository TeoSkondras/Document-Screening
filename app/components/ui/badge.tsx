import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/app/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
  {
    variants: {
      variant: {
        queued: 'bg-gray-100 text-gray-600 border-gray-300',
        running: 'bg-blue-50 text-blue-700 border-blue-200',
        succeeded: 'bg-green-50 text-green-700 border-green-200',
        failed: 'bg-red-50 text-red-700 border-red-200',
      },
    },
    defaultVariants: {
      variant: 'queued',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
