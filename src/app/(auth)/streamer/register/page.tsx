'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { registerStreamerSchema, type RegisterStreamerInput } from '@/lib/validations';
import { registerStreamerAction } from '@/app/(auth)/actions';

export default function StreamerRegisterPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<RegisterStreamerInput>({
    resolver: zodResolver(registerStreamerSchema),
    defaultValues: {
      fullName: '',
      tiktokUsername: '',
      email: '',
      password: '',
      desiredRefCode: '',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await registerStreamerAction(values);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Аккаунт создан. Проверьте почту для подтверждения.');
      setDone(true);
    });
  });

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Проверьте электронную почту</CardTitle>
          <CardDescription>
            Мы отправили вам ссылку для подтверждения. После подтверждения аккаунт пойдёт на модерацию.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.replace('/streamer/login')}>
            Перейти к входу
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Создать аккаунт стримера</CardTitle>
        <CardDescription>Получите уникальную реферальную ссылку и зарабатывайте с каждого заказа.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} method="post" action="#" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Полное имя</Label>
            <Input id="fullName" autoComplete="name" {...form.register('fullName')} />
            {form.formState.errors.fullName && (
              <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tiktokUsername">TikTok @ (необязательно)</Label>
            <Input id="tiktokUsername" placeholder="alex_streams" {...form.register('tiktokUsername')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
            <p className="text-xs text-muted-foreground">Не менее 8 символов.</p>
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="desiredRefCode">Реферальный код</Label>
            <div className="flex items-center rounded-md border bg-muted/40 overflow-hidden">
              <span className="px-3 text-xs text-muted-foreground select-none">/?ref=</span>
              <Input
                id="desiredRefCode"
                className="border-0 bg-transparent focus-visible:ring-0"
                placeholder="alex_2024"
                {...form.register('desiredRefCode')}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Буквы, цифры, дефис, подчёркивание. 3–32 символа.
            </p>
            {form.formState.errors.desiredRefCode && (
              <p className="text-xs text-destructive">{form.formState.errors.desiredRefCode.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Создать аккаунт
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Уже есть аккаунт?{' '}
            <Link href="/streamer/login" className="underline-offset-4 hover:underline text-foreground">
              Войти
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
