import { redirect } from 'next/navigation';
import { Clock, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/app/(auth)/actions';

export default async function StreamerPendingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: streamer } = await supabase
    .from('streamers')
    .select('status, display_name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!streamer) redirect('/login');
  if (streamer.status === 'active') redirect('/streamer');
  if (streamer.status === 'blocked') redirect('/streamer/blocked');

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Icon + heading */}
        <div className="text-center space-y-3">
          <div className="mx-auto size-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Clock className="size-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Заявка на проверке</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Привет, <b className="text-foreground">{streamer.display_name}</b>! Ваш аккаунт получен и сейчас проходит проверку.
          </p>
        </div>

        {/* Steps */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Step done label="Регистрация завершена" />
            <Step active label="Проверка администратором" hint="Обычно в течение 24 часов" />
            <Step label="Аккаунт активирован" />
          </CardContent>
        </Card>

        {/* Email reminder */}
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <Mail className="size-4 mt-0.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            Мы отправим письмо на <b className="text-foreground">{user.email}</b> как только аккаунт будет одобрен.
          </span>
        </div>

        {/* Actions */}
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full">Выйти</Button>
        </form>
      </div>
    </div>
  );
}

function Step({
  label,
  hint,
  done,
  active,
}: {
  label: string;
  hint?: string;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 size-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          done
            ? 'border-emerald-500 bg-emerald-500'
            : active
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-muted-foreground/30'
        }`}
      >
        {done && (
          <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {active && <span className="size-2 rounded-full bg-amber-500 block" />}
      </div>
      <div>
        <p className={`text-sm font-medium ${
          done ? 'text-emerald-500' : active ? 'text-foreground' : 'text-muted-foreground'
        }`}>{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
