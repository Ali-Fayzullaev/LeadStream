'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  X,
  Music2,
  ExternalLink,
  Mail,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { registerStreamerVerifySchema, type RegisterStreamerVerifyInput } from '@/lib/validations';
import { registerStreamerAction, requestRegistrationCodeAction } from '@/app/(auth)/actions';

type Step = 'form' | 'verify' | 'done';

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
  const [step, setStep] = useState<Step>('form');
  const [code, setCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

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

  const buildCandidate = (
    values: RegisterFormShape,
  ): Omit<RegisterStreamerVerifyInput, 'code'> => ({
    fullName: values.fullName,
    tiktokUsernames: values.tiktokAccounts
      .map((a) => a.value.trim())
      .filter((v) => v.length > 0),
    email: values.email.trim(),
    password: values.password,
  });

  const startCooldown = () => {
    setResendCooldown(45);
    const t = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const startVerification = form.handleSubmit((values) => {
    setError(null);
    const candidate = buildCandidate(values);
    const parsed = registerStreamerVerifySchema.omit({ code: true }).safeParse(candidate);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Заполните форму корректно';
      setError(msg);
      toast.error(msg);
      return;
    }
    start(async () => {
      const res = await requestRegistrationCodeAction({ email: candidate.email });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Код отправлен на почту');
      setStep('verify');
      startCooldown();
    });
  });

  const submitWithCode = () => {
    setError(null);
    const candidate = buildCandidate(form.getValues());
    const parsed = registerStreamerVerifySchema.safeParse({ ...candidate, code });
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Введите 6-значный код';
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
      toast.success('Аккаунт создан!');
      setStep('done');
    });
  };

  const resendCode = () => {
    if (resendCooldown > 0) return;
    const email = form.getValues('email').trim();
    if (!email) return;
    start(async () => {
      const res = await requestRegistrationCodeAction({ email });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Новый код отправлен');
      startCooldown();
    });
  };

  if (step === 'done') {
    return (
      <Card className="shadow-xl ring-1 ring-border/60">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="size-6" />
          </div>
          <CardTitle className="text-2xl">Аккаунт создан</CardTitle>
          <CardDescription>
            Заявка отправлена на модерацию. После проверки администратором вы получите уведомление
            и сможете войти в кабинет.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.replace('/login')}>
            Перейти к входу
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verify') {
    return (
      <Card className="shadow-xl ring-1 ring-border/60">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <KeyRound className="size-5" />
            <span className="text-xs uppercase tracking-wider font-medium">Подтверждение</span>
          </div>
          <CardTitle className="text-2xl">Введите код из письма</CardTitle>
          <CardDescription>
            Мы отправили 6-значный код на{' '}
            <span className="font-medium text-foreground">{form.getValues('email')}</span>. Код
            действителен 10 минут.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Код подтверждения</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="text-center text-2xl font-semibold tracking-[0.5em]"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={submitWithCode}
            disabled={pending || code.length !== 6}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Подтвердить и создать аккаунт
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep('form');
                setError(null);
                setCode('');
              }}
              disabled={pending}
            >
              <ArrowLeft className="size-4" />
              Назад
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resendCode}
              disabled={pending || resendCooldown > 0}
            >
              <Mail className="size-4" />
              {resendCooldown > 0 ? `Отправить снова (${resendCooldown})` : 'Отправить снова'}
            </Button>
          </div>
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
        <form onSubmit={startVerification} method="post" action="#" className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fullName">Полное имя</Label>
            <Input
              id="fullName"
              autoComplete="name"
              {...form.register('fullName', { required: true, minLength: 2 })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Music2 className="size-4 text-amber-500" />
                TikTok аккаунты
              </Label>
              <span className="text-xs text-muted-foreground">{fields.length}/10</span>
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
                <code className="rounded bg-background px-1 py-0.5">@alex_streams</code>. Вставьте
                сюда только то, что после <code className="rounded bg-background px-1 py-0.5">@</code>.
              </p>
              <p>
                Ссылка на профиль:{' '}
                <a
                  href="https://www.tiktok.com/@tiktok"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-amber-600 hover:underline dark:text-amber-400"
                >
                  tiktok.com/@username <ExternalLink className="size-3" />
                </a>
                .
              </p>
              <p>Можно добавить несколько аккаунтов.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
            <p className="text-xs text-muted-foreground">
              На этот адрес мы отправим 6-значный код подтверждения.
            </p>
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

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">🔗 Реферальный код</p>
            <p className="mt-1">
              Мы создадим уникальный реф-код автоматически на основе вашего имени. После регистрации
              вы найдёте его в дашборде вместе с готовой реферальной ссылкой.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-2" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Получить код на почту
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Уже есть аккаунт?{' '}
            <Link
              href="/login"
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
