import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin/sidebar';
import { getAppSettings } from '@/lib/settings';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/manager/login');

  // Check if manager exists
  const { data: manager } = await supabase
    .from('managers')
    .select('id, display_name, email')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!manager) redirect('/manager/login');

  const settings = await getAppSettings();

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <AdminSidebar
        userName={manager.display_name}
        userEmail={manager.email}
        userAvatar={null}
        siteName={settings.site_name}
        logoUrl={settings.logo_url}
      />
      <main className="flex-1 min-w-0">
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
