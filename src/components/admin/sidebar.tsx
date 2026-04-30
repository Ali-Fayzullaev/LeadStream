'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Settings,
  Menu,
  X,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { signOutAction } from '@/app/(auth)/actions';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Дашборд', icon: LayoutDashboard, exact: true },
  { href: '/admin/streamers', label: 'Стримеры', icon: Users },
  { href: '/admin/orders', label: 'Заказы', icon: ShoppingCart },
  { href: '/admin/settings', label: 'Настройки', icon: Settings },
];

export function AdminSidebar({
  userName,
  userEmail,
  userAvatar,
}: {
  userName: string;
  userEmail: string;
  userAvatar: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
        <Link href="/admin" className="font-semibold tracking-tight">
          LeadStream <span className="text-primary text-xs ml-1">admin</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Открыть меню"
        >
          <Menu className="size-5" />
        </Button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen w-[260px] shrink-0',
          'flex flex-col border-r bg-card',
          'transition-transform duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-semibold tracking-tight"
            onClick={() => setMobileOpen(false)}
          >
            <div className="size-7 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">L</span>
            </div>
            <span>LeadStream</span>
            <span className="text-primary text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10">
              admin
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрыть меню"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <SidebarSection label="Основное">
            {NAV.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </SidebarSection>
        </nav>

        {/* Footer: user card */}
        <div className="border-t p-3 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2 rounded-md">
            <UserAvatar name={userName} avatarUrl={userAvatar} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{userName}</div>
              <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={signOutAction} className="flex-1">
              <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
                <LogOut className="size-4" />
                Выйти
              </Button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon
        className={cn(
          'size-4 shrink-0 transition-colors',
          active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
        )}
      />
      <span>{item.label}</span>
      {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
    </Link>
  );
}
