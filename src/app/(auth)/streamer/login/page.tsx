'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loginSchema, type LoginInput } from '@/lib/validations';
import { loginAction } from '@/app/(auth)/actions';

export default function StreamerLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/streamer';
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await loginAction(values, 'streamer');
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Добро пожаловать');
      router.replace(next);
      router.refresh();
    });
  });

  return (
    <Card className="shadow-xl ring-1 ring-border/60">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Вход для стримера</CardTitle>
        <CardDescription>Войдите, чтобы посмотреть статистику и заказы.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} method="post" action="#" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Войти
          </Button>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <Link href="/streamer/register" className="underline-offset-4 hover:underline">
              Создать аккаунт
            </Link>
            <Link href="/admin/login" className="underline-offset-4 hover:underline">
              Вход админа
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
