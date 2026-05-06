'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, User, Menu, X, LogOut, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOutAction } from '@/app/(auth)/actions';

interface NavItem { href: string; label: string; icon: LucideIcon; exact?: boolean; }

const NAV: NavItem[] = [
  { href: '/broker', label: 'Мои лиды', icon: LayoutDashboard, exact: true },
  { href: '/broker/profile', label: 'Профиль', icon: User },
];

export function BrokerSidebar({
  userName, userEmail, siteName,
}: { userName: string; userEmail: string; siteName: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const content = (showClose: boolean) => (
    <>
      <div className="flex h-14 items-center border-b px-4 justify-between">
        <Link href="/broker" className="flex items-center gap-2 font-semibold tracking-tight" onClick={() => setMobileOpen(false)}>
          <span className="size-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-sm font-bold">B</span>
          </span>
          <span className="truncate">{siteName}</span>
          <span className="text-primary text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 shrink-0">broker</span>
        </Link>
        {showClose && (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Закрыть">
            <X className="size-5" />
          </Button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Рабочая зона</div>
        {NAV.map((item) => <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />)}
      </nav>
      <div className="border-t p-3 space-y-2">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <UserAvatar name={userName} avatarUrl={null} size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{userName}</div>
            <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={signOutAction} className="flex-1">
            <Button type="submit" variant="ghost" size="sm" className="w-full gap-2 justify-start">
              <LogOut className="size-4" />Выйти
            </Button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
        <Link href="/broker" className="flex items-center gap-2 font-semibold">
          <span className="size-7 rounded-md bg-primary flex items-center justify-center"><span className="text-primary-foreground text-sm font-bold">B</span></span>
          <span>{siteName}</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></Button>
      </header>
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />}
      <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:shrink-0 border-r bg-card">
        {content(false)}
      </aside>
      <aside className={cn('lg:hidden fixed top-0 left-0 z-50 h-screen w-[260px] flex flex-col border-r bg-card shadow-xl transition-transform duration-300', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        {content(true)}
      </aside>
    </>
  );
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link href={item.href} onClick={onClick} className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors', active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
      <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      {item.label}
    </Link>
  );
}
