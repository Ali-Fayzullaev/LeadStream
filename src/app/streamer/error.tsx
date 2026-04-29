'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function StreamerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Streamer error:', error);
  }, [error]);
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
      <h2 className="text-lg font-semibold">Ошибка загрузки</h2>
      <p className="text-sm text-muted-foreground">{error.message || 'Непредвиденная ошибка.'}</p>
      <Button onClick={() => reset()} variant="outline">Повторить</Button>
    </div>
  );
}
