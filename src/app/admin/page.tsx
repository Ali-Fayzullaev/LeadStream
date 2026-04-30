import Link from 'next/link';
import { Package, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OrdersChart } from '@/components/streamer/orders-chart';
import { UserAvatar } from '@/components/user-avatar';
import { PageHeader } from '@/components/page-header';
import { formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
const DAYS = 30;

export default async function AdminHomePage() {
  const supabase = createClient();

  const [{ data: streamers }, { data: stats }, { data: streamerAvatars }] = await Promise.all([
    supabase.from('streamers').select('id, status'),
    supabase.from('streamer_stats').select('id, display_name, ref_code, status, orders_count, revenue, commission'),
    supabase.from('streamers').select('id, avatar_url'),
  ]);

  const avatarMap = new Map((streamerAvatars ?? []).map((s) => [s.id, (s as { avatar_url?: string | null }).avatar_url ?? null]));

  // Global totals — sum across the leaderboard.
  const totalOrders = (stats ?? []).reduce((s, r) => s + (r.orders_count ?? 0), 0);
  const totalRevenue = (stats ?? []).reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const totalCommission = (stats ?? []).reduce((s, r) => s + Number(r.commission ?? 0), 0);
  const activeStreamers = (streamers ?? []).filter((s) => s.status === 'active').length;
  const pendingStreamers = (streamers ?? []).filter((s) => s.status === 'pending').length;

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (DAYS - 1));

  const { data: daily } = await supabase
    .from('orders')
    .select('created_at, amount')
    .gte('created_at', since.toISOString());

  // Bucket per day.
  const buckets = new Map<string, { orders: number; revenue: number }>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { orders: 0, revenue: 0 });
  }
  for (const row of daily ?? []) {
    const key = row.created_at.slice(0, 10);
    const b = buckets.get(key);
    if (b) {
      b.orders += 1;
      b.revenue += Number(row.amount);
    }
  }
  const series = Array.from(buckets.entries()).map(([day, b]) => ({
    day: day.slice(5),
    orders: b.orders,
    revenue: Number(b.revenue.toFixed(2)),
  }));

  const leaderboard = [...(stats ?? [])]
    .filter((r) => r.status === 'active')
    .sort((a, b) => Number(b.revenue ?? 0) - Number(a.revenue ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Дашборд админа"
        description={`Все стримеры, все заказы, последние ${DAYS} дней.`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Kpi icon={<Users className="size-4" />} label="Стримеры"
             value={`${activeStreamers}/${(streamers ?? []).length}`}
             hint={pendingStreamers > 0 ? `${pendingStreamers} ожидают проверки` : 'все проверены'} />
        <Kpi icon={<Package className="size-4" />} label="Заказы" value={formatNumber(totalOrders)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Заказы и выручка ({DAYS} дней)</CardTitle>
        </CardHeader>
        <CardContent>
          <OrdersChart data={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Топ-стримеры</CardTitle>
            <CardDescription>Топ-10 активных стримеров по выручке.</CardDescription>
          </div>
          <Link href="/admin/streamers" className="text-sm text-muted-foreground hover:text-foreground">
            Стримеры →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {leaderboard.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">Активных стримеров пока нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium w-10">#</th>
                    <th className="text-left px-4 py-2 font-medium">Стример</th>
                    <th className="text-left px-4 py-2 font-medium">Код</th>
                    <th className="text-right px-4 py-2 font-medium">Заказы</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((r, i) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={r.display_name} avatarUrl={avatarMap.get(r.id) ?? null} size={26} />
                          <span className="font-medium">{r.display_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{r.ref_code}</td>
                      <td className="px-4 py-2 text-right">{r.orders_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
