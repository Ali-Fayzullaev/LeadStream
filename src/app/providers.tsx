'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { ServiceWorkerKiller } from '@/components/service-worker-killer';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ServiceWorkerKiller />
      {children}
      <Toaster richColors position="top-right" />
    </NextThemesProvider>
  );
}
