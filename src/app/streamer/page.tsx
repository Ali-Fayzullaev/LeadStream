import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Package } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefLinkCard } from '@/components/streamer/ref-link-card';
import { OrdersChart } from '@/components/streamer/orders-chart';
import { formatNumber } from '@/lib/utils';

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

  // Aggregates for this streamer (RLS already restricts to own rows).
  const { data: stats } = await supabase
    .from('streamer_stats')
    .select('orders_count, revenue, commission')
    .eq('id', streamer.id)
    .maybeSingle();

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
  const { data: recent } = await supabase
    .from('streamer_orders')
    .select('id, customer_name, customer_phone_masked, product_name, amount, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Добро пожаловать, {streamer.display_name}</h1>
        <p className="text-sm text-muted-foreground">
          Ставка комиссии: <b className="text-foreground">{streamer.commission_percent}%</b>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-1 max-w-xs">
        <Kpi
          icon={<Package className="size-4" />}
          label="Заказы (за всё время)"
          value={formatNumber(stats?.orders_count ?? 0)}
        />
      </div>

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
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2">{r.customer_name}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.customer_phone_masked}</td>
                      <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">
              Заказов ещё нет — поделитесь ссылкой!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

const STATUS_RU: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  shipped: 'Отправлен',
  completed: 'Выполнен',
  cancelled: 'Отменён',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    confirmed: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    shipped: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30',
    completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[status] ?? ''}`}>
      {STATUS_RU[status] ?? status}
    </span>
  );
}
