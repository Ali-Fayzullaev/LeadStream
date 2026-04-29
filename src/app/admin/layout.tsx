import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LogOut, LayoutDashboard, Users, ShoppingBag, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignOutButton } from './sign-out-button';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary" /> LeadStream
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/admin" icon={LayoutDashboard}>
              Dashboard
            </NavLink>
            <NavLink href="/admin/streamers" icon={Users}>
              Streamers
            </NavLink>
            <NavLink href="/admin/orders" icon={ShoppingBag}>
              Orders
            </NavLink>
            <ThemeToggle />
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="hidden items-center gap-1.5 rounded-md px-3 py-2 hover:bg-accent sm:inline-flex"
    >
      <Icon className="size-4" /> {children}
    </Link>
  );
}

// Re-export for sibling files. Imported above already.
export { LogOut };
