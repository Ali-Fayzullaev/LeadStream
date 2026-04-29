import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOutAction } from '@/app/(auth)/actions';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/admin/login');

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold tracking-tight">
              LeadStream <span className="text-primary text-xs ml-1 align-top">admin</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/admin" className="hover:text-foreground">Дашборд</Link>
              <Link href="/admin/streamers" className="hover:text-foreground">Стримеры</Link>
              <Link href="/admin/orders" className="hover:text-foreground">Заказы</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">{profile.full_name ?? profile.email}</span>
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
