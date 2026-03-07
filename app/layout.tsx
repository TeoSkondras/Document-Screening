import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Document Screening Assistant',
  description: 'Score resumes against a rubric using AI judges',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-parchment text-ink min-h-screen">{children}</body>
    </html>
  );
}
