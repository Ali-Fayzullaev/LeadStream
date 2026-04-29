import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { OrderForm } from '@/components/order-form';
import { resolveRefFromCookie } from '@/lib/ref';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const ref = await resolveRefFromCookie();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b">
        <div className="container flex items-center justify-between h-14">
          <span className="font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            LeadStream
          </span>
          <ThemeToggle />
          <Link href="/streamer/login" className="text-sm text-muted-foreground hover:text-foreground">
            Войти
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Оставьте заявку</CardTitle>
                <CardDescription>Мы перезвоним вам в течение 15 минут для подтверждения.</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderForm
                refCode={ref?.refCode ?? null}
                streamerName={ref?.streamerName ?? null}
              />
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t">
        <div className="container py-4 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} LeadStream
        </div>
      </footer>
    </div>
  );
}
