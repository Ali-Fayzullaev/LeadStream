'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  User,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
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
  { href: '/streamer', label: 'Дашборд', icon: LayoutDashboard, exact: true },
  { href: '/streamer/orders', label: 'Заказы', icon: ShoppingCart },
  { href: '/streamer/profile', label: 'Профиль', icon: User },
];

const STORAGE_KEY = 'leadstream:sidebar-collapsed';

export function StreamerSidebar({
  userName,
  userAvatar,
  showNav,
  siteName,
  logoUrl,
}: {
  userName: string;
  userAvatar: string | null;
  showNav: boolean;
  siteName: string;
  logoUrl: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === '1') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
        <Link href="/streamer" className="flex items-center gap-2 font-semibold tracking-tight">
          <BrandMark logoUrl={logoUrl} />
          <span>{siteName}</span>
        </Link>
        {showNav && (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Меню">
            <Menu className="size-5" />
          </Button>
        )}
      </header>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen shrink-0',
          'flex flex-col border-r bg-card',
          'transition-[width,transform] duration-300 ease-out',
          collapsed ? 'lg:w-[72px] w-[260px]' : 'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b',
            collapsed ? 'lg:justify-center lg:px-0 px-4 justify-between' : 'px-4 justify-between',
          )}
        >
          <Link
            href="/streamer"
            className="flex items-center gap-2 font-semibold tracking-tight min-w-0"
            onClick={() => setMobileOpen(false)}
          >
            <BrandMark logoUrl={logoUrl} />
            <span className={cn('truncate', collapsed && 'lg:hidden')}>{siteName}</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрыть"
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {showNav && (
            <div className="space-y-1">
              <div
                className={cn(
                  'px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground',
                  collapsed && 'lg:hidden',
                )}
              >
                Кабинет
              </div>
              {NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          )}
        </nav>

        <div className="border-t p-3 space-y-2">
          <div
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-2',
              collapsed && 'lg:justify-center lg:px-0',
            )}
            title={collapsed ? userName : undefined}
          >
            <UserAvatar name={userName} avatarUrl={userAvatar} size={36} />
            <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
              <div className="text-sm font-medium truncate">{userName}</div>
              <div className="text-xs text-muted-foreground">Стример</div>
            </div>
          </div>

          <div className={cn('flex items-center gap-1', collapsed && 'lg:flex-col')}>
            <ThemeToggle />
            <form action={signOutAction} className={cn('flex-1', collapsed && 'lg:flex-none lg:w-full')}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full gap-2',
                  collapsed ? 'lg:justify-center justify-start lg:px-0' : 'justify-start',
                )}
                aria-label="Выйти"
                title={collapsed ? 'Выйти' : undefined}
              >
                <LogOut className="size-4" />
                <span className={cn(collapsed && 'lg:hidden')}>Выйти</span>
              </Button>
            </form>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex size-9 shrink-0"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'}
              title={collapsed ? 'Развернуть' : 'Свернуть'}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  item,
  collapsed,
  onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-md text-sm transition-colors',
        collapsed ? 'lg:justify-center lg:px-0 lg:py-2.5 px-3 py-2' : 'px-3 py-2',
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
      <span className={cn(collapsed && 'lg:hidden')}>{item.label}</span>
      {active && (
        <span className={cn('ml-auto size-1.5 rounded-full bg-primary', collapsed && 'lg:hidden')} />
      )}
    </Link>
  );
}

function BrandMark({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <span className="size-7 rounded-md bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span className="size-7 rounded-md bg-primary flex items-center justify-center shrink-0">
      <span className="text-primary-foreground text-sm font-bold">L</span>
    </span>
  );
}
