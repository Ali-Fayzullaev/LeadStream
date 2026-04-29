import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOutAction } from '@/app/(auth)/actions';

export default async function StreamerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/streamer/login');

  const { data: streamer } = await supabase
    .from('streamers')
    .select('display_name, status, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!streamer) {
    // No streamer row — likely an admin landed here. Bounce.
    redirect('/admin');
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/streamer" className="font-semibold tracking-tight">
              LeadStream
            </Link>
            {streamer.status === 'active' && (
              <nav className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                <Link href="/streamer" className="hover:text-foreground">Дашборд</Link>
                <Link href="/streamer/orders" className="hover:text-foreground">Заказы</Link>
                <Link href="/streamer/profile" className="hover:text-foreground">Профиль</Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2">
            {streamer.avatar_url ? (
              <Image
                src={streamer.avatar_url}
                alt={streamer.display_name ?? ''}
                width={28}
                height={28}
                className="rounded-full object-cover size-7"
                unoptimized
              />
            ) : (
              <div className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                {(streamer.display_name ?? '?')[0].toUpperCase()}
              </div>
            )}
            <span className="hidden sm:inline text-xs text-muted-foreground">{streamer.display_name}</span>
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">Выйти</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-8">{children}</main>
    </div>
  );
}
