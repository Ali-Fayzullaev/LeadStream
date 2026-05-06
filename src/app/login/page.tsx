'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Zap } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') ?? '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        setError('Неверный email или пароль');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Ошибка авторизации'); return; }

      const role = user.user_metadata?.role as string | undefined;

      if (role === 'admin') {
        router.replace(nextUrl.startsWith('/admin') ? nextUrl : '/admin');
        return;
      }

      // Check broker
      const { data: broker } = await supabase
        .from('brokers').select('id').eq('user_id', user.id).maybeSingle();
      if (broker) {
        router.replace(nextUrl.startsWith('/broker') ? nextUrl : '/broker');
        return;
      }

      // Check manager
      const { data: manager } = await supabase
        .from('managers').select('id').eq('user_id', user.id).maybeSingle();
      if (manager) {
        router.replace(nextUrl.startsWith('/manager') ? nextUrl : '/manager');
        return;
      }

      // Streamer
      router.replace(nextUrl.startsWith('/streamer') ? nextUrl : '/streamer');
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary shadow-lg shadow-primary/25 mx-auto">
            <Zap className="size-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">LeadStream</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Единый вход для всех ролей</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border rounded-2xl shadow-xl shadow-black/5 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Добро пожаловать</h2>
            <p className="text-sm text-muted-foreground">Введите ваши данные для входа</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Пароль</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-semibold"
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Войти'
              )}
            </Button>
          </form>

          {/* Roles hint */}
          <div className="pt-1 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Система автоматически определит вашу роль
            </p>
            <div className="flex items-center justify-center gap-3 mt-2">
              {['Стример', 'Менеджер', 'Брокер', 'Админ'].map(role => (
                <span key={role} className="text-[11px] text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full">
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-muted-foreground">
          Нет аккаунта?{' '}
          <Link href="/streamer/register" className="font-medium text-primary hover:underline underline-offset-4">
            Зарегистрироваться как стример
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
