'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loginSchema, type LoginInput } from '@/lib/validations';
import { loginAction } from '@/app/(auth)/actions';

export default function AdminLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const rawNext = search.get('next') ?? '';
  const next = rawNext.startsWith('/') ? rawNext : '/admin';
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await loginAction(values, 'admin');
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Добро пожаловать, админ');
      router.replace(next);
      router.refresh();
    });
  });

  return (
    <Card className="shadow-xl ring-1 ring-border/60">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="size-5" />
          <span className="text-xs uppercase tracking-wider font-medium">Администратор</span>
        </div>
        <CardTitle className="text-2xl">Вход для админа</CardTitle>
        <CardDescription>Только для владельцев и менеджеров.</CardDescription>
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
          <p className="text-sm text-center text-muted-foreground">
            Вы стример?{' '}
            <Link href="/login" className="underline-offset-4 hover:underline text-foreground">
              Вход для стримеров
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
