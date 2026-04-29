import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm font-mono text-muted-foreground">404</p>
        <h1 className="text-3xl font-bold tracking-tight">Страница не найдена</h1>
        <p className="text-muted-foreground">
          Такая страница не существует или была перемещена.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button asChild>
            <Link href="/">На главную</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/streamer/login">Вход для стримеров</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
