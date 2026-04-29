import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateStreamerForm } from '@/components/admin/create-streamer-form';
import { StreamersTable, type StreamerRow } from '@/components/admin/streamers-table';

export const dynamic = 'force-dynamic';

export default async function AdminStreamersPage() {
  // Use service-role client to also fetch emails from profiles (no PII leak — admin-only page).
  const admin = createAdminClient();

  const [{ data: streamers }, { data: stats }, { data: profiles }] = await Promise.all([
    admin
      .from('streamers')
      .select('id, user_id, display_name, ref_code, status, commission_percent, created_at, avatar_url')
      .order('created_at', { ascending: false }),
    admin.from('streamer_stats').select('id, orders_count, revenue, commission'),
    admin.from('profiles').select('id, email'),
  ]);

  const statsMap = new Map((stats ?? []).map((r) => [r.id, r]));
  const emailMap = new Map((profiles ?? []).map((r) => [r.id, r.email]));

  const rows: StreamerRow[] = (streamers ?? []).map((s) => {
    const st = statsMap.get(s.id);
    return {
      id: s.id,
      display_name: s.display_name,
      ref_code: s.ref_code,
      status: s.status,
      commission_percent: Number(s.commission_percent),
      orders_count: st?.orders_count ?? 0,
      revenue: Number(st?.revenue ?? 0),
      commission: Number(st?.commission ?? 0),
      email: emailMap.get(s.user_id) ?? null,
      created_at: s.created_at,
      avatar_url: (s as { avatar_url?: string | null }).avatar_url ?? null,
    };
  });

  const pending = rows.filter((r) => r.status === 'pending').length;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Стримеры</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} всего{pending > 0 && ` · ${pending} ожидают проверки`}
          </p>
        </div>
        <CreateStreamerForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Все стримеры</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <StreamersTable rows={rows} appUrl={appUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
