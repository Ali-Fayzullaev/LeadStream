'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Plus, X, Music2, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { registerStreamerSchema, type RegisterStreamerInput } from '@/lib/validations';
import { registerStreamerAction } from '@/app/(auth)/actions';

interface RegisterFormShape {
  fullName: string;
  tiktokAccounts: { value: string }[];
  email: string;
  password: string;
}

export default function StreamerRegisterPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<RegisterFormShape>({
    defaultValues: {
      fullName: '',
      tiktokAccounts: [{ value: '' }],
      email: '',
      password: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tiktokAccounts',
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    // Build the validated input shape from form.
    const candidate: RegisterStreamerInput = {
      fullName: values.fullName,
      tiktokUsernames: values.tiktokAccounts
        .map((a) => a.value.trim())
        .filter((v) => v.length > 0),
      email: values.email,
      password: values.password,
    };
    const parsed = registerStreamerSchema.safeParse(candidate);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Заполните форму корректно';
      setError(msg);
      toast.error(msg);
      return;
    }
    start(async () => {
      const res = await registerStreamerAction(parsed.data);
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
    <Card className="shadow-xl ring-1 ring-border/60">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Создать аккаунт стримера</CardTitle>
        <CardDescription>
          Получите уникальную реферальную ссылку и зарабатывайте с каждого заказа.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} method="post" action="#" className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fullName">Полное имя</Label>
            <Input
              id="fullName"
              autoComplete="name"
              {...form.register('fullName', { required: true, minLength: 2 })}
            />
          </div>

          {/* TikTok accounts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Music2 className="size-4 text-fuchsia-500" />
                TikTok аккаунты
              </Label>
              <span className="text-xs text-muted-foreground">
                {fields.length}/10
              </span>
            </div>

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <div className="flex flex-1 items-center rounded-md border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                    <span className="px-3 text-sm text-muted-foreground select-none">@</span>
                    <Input
                      placeholder="alex_streams"
                      autoComplete="off"
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      {...form.register(`tiktokAccounts.${index}.value` as const)}
                    />
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(index)}
                      aria-label="Удалить аккаунт"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {fields.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ value: '' })}
                className="gap-2"
              >
                <Plus className="size-4" />
                Добавить ещё аккаунт
              </Button>
            )}

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Как выглядит TikTok @username:</p>
              <p>
                Откройте свой профиль в приложении TikTok — под аватаркой видно строку вида{' '}
                <code className="rounded bg-background px-1 py-0.5">@alex_streams</code>. Вставьте сюда
                только то, что после <code className="rounded bg-background px-1 py-0.5">@</code>.
              </p>
              <p>
                Ссылка на профиль выглядит так:{' '}
                <a
                  href="https://www.tiktok.com/@tiktok"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-fuchsia-600 hover:underline dark:text-fuchsia-400"
                >
                  tiktok.com/@username <ExternalLink className="size-3" />
                </a>
                .
              </p>
              <p>Можно добавить несколько аккаунтов, если стримите с разных профилей.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
            <p className="text-xs text-muted-foreground">Не менее 8 символов.</p>
          </div>

          <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">🔗 Реферальный код</p>
            <p className="mt-1">
              Мы создадим уникальный реф-код автоматически на основе вашего имени. После регистрации вы найдёте его
              в дашборде — вместе с готовой реферальной ссылкой, которую можно вставлять в TikTok.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-2" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Создать аккаунт
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Уже есть аккаунт?{' '}
            <Link
              href="/streamer/login"
              className="underline-offset-4 hover:underline text-foreground"
            >
              Войти
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
