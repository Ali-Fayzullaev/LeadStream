'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm font-mono text-muted-foreground">500</p>
        <h1 className="text-3xl font-bold tracking-tight">Что-то пошло не так</h1>
        <p className="text-muted-foreground">
          Произошла непредвиденная ошибка. Обновите страницу — если не поможет, свяжитесь с админом.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-muted-foreground">ref: {error.digest}</p>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={() => reset()}>Повторить</Button>
          <Button variant="ghost" onClick={() => (window.location.href = '/')}>На главную</Button>
        </div>
      </div>
    </div>
  );
}
