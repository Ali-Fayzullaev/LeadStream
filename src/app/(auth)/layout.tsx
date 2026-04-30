import Link from 'next/link';
import { BarChart3, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getAppSettings } from '@/lib/settings';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { site_name, logo_url } = await getAppSettings();
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      {/* Brand pane (lg+) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 text-white">
        {/* Animated gradient background */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_20%_10%,rgba(168,85,247,0.55),transparent_60%),radial-gradient(60%_50%_at_80%_90%,rgba(236,72,153,0.4),transparent_60%),linear-gradient(135deg,#0f0a24_0%,#1a0b3a_50%,#2d0a5e_100%)]"
        />
        {/* Grid pattern */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]"
        />
        {/* Soft floating blobs */}
        <div aria-hidden className="absolute top-1/3 -left-10 size-72 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div aria-hidden className="absolute bottom-10 right-10 size-60 rounded-full bg-violet-500/30 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          {logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo_url} alt="" className="size-9 rounded-lg object-contain bg-white/10 p-1" />
          ) : (
            <span className="size-9 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <Sparkles className="size-5" />
            </span>
          )}
          <span>{site_name}</span>
        </Link>

        <div className="relative space-y-8 max-w-md">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium ring-1 ring-white/20">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              Платформа онлайн
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Управляйте трафиком стримеров —{' '}
              <span className="bg-gradient-to-r from-fuchsia-300 via-pink-200 to-violet-200 bg-clip-text text-transparent">
                как профи
              </span>
              .
            </h1>
            <p className="text-white/70 text-sm leading-relaxed">
              Реферальное отслеживание, прозрачная статистика, мгновенные уведомления — всё, что нужно для роста.
            </p>
          </div>

          <ul className="space-y-3 text-sm">
            <Feature icon={<BarChart3 className="size-4" />} title="Реал-тайм статистика">
              Заказы, выручка и комиссия — на одном экране.
            </Feature>
            <Feature icon={<ShieldCheck className="size-4" />} title="Безопасность">
              Row-level security и RLS-политики на уровне БД.
            </Feature>
            <Feature icon={<Zap className="size-4" />} title="Мгновенные уведомления">
              Telegram-бот шлёт алерт о каждом заказе.
            </Feature>
          </ul>
        </div>

        <div className="relative text-xs text-white/50">
          © {new Date().getFullYear()} {site_name}. Все права защищены.
        </div>
      </aside>

      {/* Form pane */}
      <section className="relative flex flex-col bg-gradient-to-br from-background via-muted/40 to-background">
        {/* Decorative blurs (light theme readability boost) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-fuchsia-500/10 blur-3xl dark:bg-fuchsia-500/20"
        />
        <header className="relative flex items-center justify-between px-6 lg:px-10 py-4 border-b lg:border-b-0">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight lg:hidden">
            {logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo_url} alt="" className="size-7 rounded-md object-contain" />
            ) : (
              <span className="size-7 rounded-md bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-bold">L</span>
              </span>
            )}
            <span>{site_name}</span>
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="relative flex-1 flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/20">
        {icon}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-white/60 text-xs leading-relaxed">{children}</div>
      </div>
    </li>
  );
}
