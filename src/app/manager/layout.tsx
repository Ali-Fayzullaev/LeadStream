import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ManagerSidebar } from '@/components/manager/sidebar';
import { getAppSettings } from '@/lib/settings';
import { headers } from 'next/headers';

/**
 * Manager layout: renders sidebar for all /manager/* pages except
 * /manager/login and /manager/blocked (which are public-ish).
 */
export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get('x-pathname') ?? '';

  // Public sub-routes — render children only, no sidebar / no auth check
  if (pathname === '/manager/login' || pathname.startsWith('/manager/login?') ||
      pathname === '/manager/blocked' || pathname.startsWith('/manager/blocked?')) {
    return <>{children}</>;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/manager/login');

  const { data: manager } = await supabase
    .from('managers')
    .select('id, display_name, email, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!manager) redirect('/manager/login');
  if (manager.status === 'blocked') redirect('/manager/blocked');

  const settings = await getAppSettings();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <ManagerSidebar
        userName={manager.display_name}
        userEmail={manager.email}
        userAvatar={null}
        siteName={settings.site_name}
        logoUrl={settings.logo_url}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1">
          <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
