import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BrokerBlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-sm">
        <ShieldX className="size-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">Аккаунт заблокирован</h1>
        <p className="text-muted-foreground">Ваш аккаунт брокера заблокирован. Обратитесь к вашему менеджеру.</p>
        <Button asChild variant="outline">
          <Link href="/login">Войти под другим аккаунтом</Link>
        </Button>
      </div>
    </div>
  );
}
