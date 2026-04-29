import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function ThanksPage({ searchParams }: { searchParams: { id?: string } }) {
  const id = searchParams?.id;
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="font-semibold tracking-tight">LeadStream</Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto size-12 rounded-full bg-primary/10 grid place-items-center mb-2">
              <CheckCircle2 className="size-6 text-primary" />
            </div>
            <CardTitle>Заказ принят</CardTitle>
            <CardDescription>
              Спасибо! Мы позвоним вам в течение 15 минут для подтверждения деталей.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {id && (
              <p className="text-center text-sm text-muted-foreground">
                Номер заказа: <code className="text-foreground">{id}</code>
              </p>
            )}
            <Button asChild className="w-full" variant="outline">
              <Link href="/">На главную</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
