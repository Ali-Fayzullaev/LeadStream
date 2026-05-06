import { redirect } from 'next/navigation';
import { Ban } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function StreamerBlockedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: streamer } = await supabase
    .from('streamers')
    .select('status, notes')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!streamer) redirect('/login');
  if (streamer.status === 'active') redirect('/streamer');
  if (streamer.status === 'pending') redirect('/streamer/pending');

  return (
    <Card>
      <CardHeader>
        <div className="mx-auto size-12 rounded-full bg-destructive/10 grid place-items-center mb-2">
          <Ban className="size-6 text-destructive" />
        </div>
        <CardTitle className="text-center">Account blocked</CardTitle>
        <CardDescription className="text-center">
          {streamer.notes ?? 'Your account has been blocked. Contact the admin if you think this is a mistake.'}
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
