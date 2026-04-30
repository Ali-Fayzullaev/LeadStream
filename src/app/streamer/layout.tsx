import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StreamerSidebar } from '@/components/streamer/sidebar';

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
    redirect('/admin');
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <StreamerSidebar
        userName={streamer.display_name ?? 'Стример'}
        userAvatar={streamer.avatar_url ?? null}
        showNav={streamer.status === 'active'}
      />
      <main className="flex-1 min-w-0">
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
