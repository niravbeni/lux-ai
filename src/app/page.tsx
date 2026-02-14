'use client';

import { Suspense } from 'react';
import AppShell from '@/components/app-shell';

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex w-full h-full items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" />
      </div>
    }>
      <AppShell />
    </Suspense>
  );
}
