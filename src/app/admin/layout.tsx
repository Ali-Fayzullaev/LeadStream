import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin/sidebar';
import { getAppSettings } from '@/lib/settings';

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

  const settings = await getAppSettings();

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <AdminSidebar
        userName={profile.full_name ?? profile.email}
        userEmail={profile.email}
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
