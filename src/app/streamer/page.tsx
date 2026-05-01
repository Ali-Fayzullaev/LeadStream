import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Sparkles, Trophy } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefLinkCard } from '@/components/streamer/ref-link-card';
import { OrdersChart } from '@/components/streamer/orders-chart';
import { StreamerLeaderboard } from '@/components/streamer/leaderboard';
import { StatusStats } from '@/components/streamer/status-stats';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { getOrderStatuses } from '@/lib/statuses';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const DAYS = 14;

export default async function StreamerDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/streamer/login');

  const { data: streamer } = await supabase
    .from('streamers')
    .select('id, display_name, ref_code, status, commission_percent')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!streamer) redirect('/streamer/login');
  if (streamer.status === 'pending') redirect('/streamer/pending');
  if (streamer.status === 'blocked') redirect('/streamer/blocked');

  // Daily series for the last 14 days.
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (DAYS - 1));

  const { data: daily } = await supabase
    .from('daily_stats')
    .select('day, orders_count, revenue')
    .eq('streamer_id', streamer.id)
    .gte('day', since.toISOString().slice(0, 10))
    .order('day', { ascending: true });

  // Fill missing days with zeros so chart is continuous.
  const series: { day: string; orders: number; revenue: number }[] = [];
  const map = new Map((daily ?? []).map((r) => [r.day, r]));
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    series.push({
      day: key.slice(5),
      orders: row?.orders_count ?? 0,
      revenue: Number(row?.revenue ?? 0),
    });
  }

  // Latest 5 orders (masked).
  const [{ data: recent }, statuses, { data: leaderboardRaw }, { data: allOrders }] = await Promise.all([
    supabase
      .from('streamer_orders')
      .select('id, customer_name, customer_phone_masked, product_name, amount, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    getOrderStatuses(),
    // Use admin client to read all active streamers for ranking (RLS on streamer_stats is per-streamer).
    createAdminClient()
      .from('streamer_stats')
      .select('id, display_name, revenue, orders_count')
      .eq('status', 'active'),
    // All own orders for status breakdown — RLS already restricts to this streamer only.
    supabase
      .from('streamer_orders')
      .select('status')
      .limit(10000),
  ]);
  const statusMap = new Map(statuses.map((s) => [s.key, s]));

  const leaderboard = (leaderboardRaw ?? []).map((r) => ({
    id: r.id as string,
    display_name: r.display_name as string,
    avatar_url: null,
    revenue: Number(r.revenue ?? 0),
    orders_count: Number(r.orders_count ?? 0),
  }));

  // Aggregate own orders by status.
  const statusAgg = new Map<string, number>();
  for (const o of allOrders ?? []) {
    statusAgg.set(o.status, (statusAgg.get(o.status) ?? 0) + 1);
  }
  const statusStats = statuses.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    count: statusAgg.get(s.key) ?? 0,
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Добро пожаловать, ${streamer.display_name}`}
        description={<>Ставка комиссии: <b className="text-foreground">{streamer.commission_percent}%</b></>}
      />

      {/* Status breakdown — only this streamer's own orders. */}
      <StatusStats items={statusStats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Последние 14 дней</CardTitle>
          </CardHeader>
          <CardContent>
            <OrdersChart data={series} />
          </CardContent>
        </Card>

        <RefLinkCard refCode={streamer.ref_code} appUrl={appUrl} />
      </div>

      {/* Streamer Leaderboard */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15">
              <Trophy className="size-4 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base">Рейтинг стримеров</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Топ-10 по выручке — соревнуйтесь и растите</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <StreamerLeaderboard entries={leaderboard} currentStreamerId={streamer.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Последние заказы</CardTitle>
          <Link href="/streamer/orders" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            Все заказы <ArrowRight className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recent && recent.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Клиент</th>
                    <th className="text-left px-4 py-2 font-medium">Телефон</th>
                    <th className="text-left px-4 py-2 font-medium">Статус</th>
                    <th className="text-left px-4 py-2 font-medium">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => {
                    const s = statusMap.get(r.status);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2">{r.customer_name}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.customer_phone_masked}</td>
                        <td className="px-4 py-2">
                          {s ? (
                            <StatusBadge label={s.label} color={s.color} />
                          ) : (
                            <span className="text-xs text-muted-foreground">{r.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Заказов ещё нет"
              description="Поделитесь реферальной ссылкой — первый заказ не заставит себя ждать."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
