import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  Zap,
  HeartHandshake,
  Phone,
  Clock,
  ArrowRight,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { OrderForm } from '@/components/order-form';
import { getAppSettings } from '@/lib/settings';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const REF_RE = /^[a-z0-9_-]{3,32}$/i;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  const settings = await getAppSettings();

  // Attribute order ONLY if visitor arrived via ?ref=<code> in the URL.
  // Direct visits to / never credit any streamer (even if a stale cookie is set).
  let attributedRef: string | null = null;
  let attributedStreamer: string | null = null;
  const rawRef = (searchParams?.ref ?? '').trim();
  if (rawRef && REF_RE.test(rawRef)) {
    const admin = createAdminClient();
    const { data } = await admin
      .from('streamers')
      .select('display_name, ref_code, status')
      .ilike('ref_code', rawRef)
      .maybeSingle();
    if (data && data.status === 'active') {
      attributedRef = data.ref_code;
      attributedStreamer = data.display_name;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between h-14">
          <Link href="/" className="font-semibold tracking-tight flex items-center gap-2">
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt=""
                className="size-7 rounded-md object-contain"
              />
            ) : (
              <span className="size-7 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Sparkles className="size-4 text-white" />
              </span>
            )}
            <span>{settings.site_name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/streamer/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
            >
              Войти
            </Link>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/streamer/register">
                Стать стримером
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero + Form */}
      <main className="relative flex-1">
        {/* Decorative background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-40 -left-32 size-[500px] rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/20" />
          <div className="absolute -top-20 right-0 size-[420px] rounded-full bg-fuchsia-500/10 blur-3xl dark:bg-fuchsia-500/20" />
          <div className="absolute inset-0 opacity-[0.025] dark:opacity-[0.05] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:48px_48px]" />
        </div>

        <div className="container relative grid gap-10 py-12 lg:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16 items-center">
          {/* Left: copy */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card/60 backdrop-blur px-3 py-1 text-xs font-medium">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Принимаем заявки 24/7
            </span>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Оставьте заявку —{' '}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                перезвоним за 15 минут
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
              Заполните короткую форму справа — и менеджер свяжется с вами для
              уточнения деталей и оформления заказа. Никакой регистрации и
              сложных шагов.
            </p>

            <ul className="grid gap-3 sm:grid-cols-2 max-w-lg">
              <Bullet icon={<Phone className="size-4" />} text="Звонок в течение 15 минут" />
              <Bullet icon={<ShieldCheck className="size-4" />} text="Безопасная оплата" />
              <Bullet icon={<Clock className="size-4" />} text="Доставка по всей стране" />
              <Bullet icon={<HeartHandshake className="size-4" />} text="Возврат 14 дней" />
            </ul>
          </div>

          {/* Right: form card */}
          <div className="lg:pl-4">
            <Card className="shadow-2xl ring-1 ring-border/60 backdrop-blur bg-card/95">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                    <Zap className="size-4" />
                  </span>
                  Оставьте заявку
                </CardTitle>
                <CardDescription>
                  Мы перезвоним вам в течение 15 минут для подтверждения.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OrderForm
                  refCode={attributedRef}
                  streamerName={attributedStreamer}
                  disableAttribution={!attributedRef}
                />
              </CardContent>
            </Card>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Нажимая «Оставить заявку», вы соглашаетесь на обработку персональных данных.
            </p>
          </div>
        </div>

        {/* Trust bar */}
        <div className="border-t bg-muted/30">
          <div className="container py-8 grid gap-4 sm:grid-cols-3 text-sm">
            <TrustItem
              icon={<Phone className="size-5 text-violet-500" />}
              title="Быстрый ответ"
              text="Менеджер перезвонит в течение 15 минут после заявки."
            />
            <TrustItem
              icon={<ShieldCheck className="size-5 text-emerald-500" />}
              title="Безопасно"
              text="Ваши данные защищены и не передаются третьим лицам."
            />
            <TrustItem
              icon={<HeartHandshake className="size-5 text-fuchsia-500" />}
              title="Гарантия возврата"
              text="Если что-то не так — вернём деньги в течение 14 дней."
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {settings.site_name}. Все права защищены.
          </span>
          <div className="flex items-center gap-4">
            <Link href="/streamer/login" className="hover:text-foreground transition-colors">
              Стримерам
            </Link>
            <Link href="/admin/login" className="hover:text-foreground transition-colors">
              Администрация
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span>{text}</span>
    </li>
  );
}

function TrustItem({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5">{icon}</span>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}
