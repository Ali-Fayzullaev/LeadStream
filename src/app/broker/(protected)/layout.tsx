import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BrokerSidebar } from '@/components/broker/sidebar';
import { getAppSettings } from '@/lib/settings';

export default async function ProtectedBrokerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: broker } = await supabase
    .from('brokers')
    .select('id, display_name, email, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!broker) redirect('/login');
  if (broker.status === 'blocked') redirect('/broker/blocked');

  const settings = await getAppSettings();

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <BrokerSidebar
        userName={broker.display_name}
        userEmail={broker.email}
        siteName={settings.site_name}
      />
      <main className="flex-1 min-w-0">
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
