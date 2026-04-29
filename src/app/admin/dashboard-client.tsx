'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ShoppingBag, Banknote, Users, TrendingUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { DateRangeBar, type RangePreset, presetToRange } from './date-range-bar';

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  streamerCount: number;
  series: { date: string; orders: number; revenue: number }[];
}

interface StreamerStat {
  id: string;
  name: string;
  ref_code: string;
  is_active: boolean;
  orders_count: number;
  revenue: number;
}

export function DashboardClient() {
  const [preset, setPreset] = useState<RangePreset>('month');
  const [stats, setStats] = useState<Stats | null>(null);
  const [streamers, setStreamers] = useState<StreamerStat[] | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => presetToRange(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams();
    if (range.from) qs.set('from', range.from.toISOString());
    if (range.to) qs.set('to', range.to.toISOString());

    Promise.all([
      fetch(`/api/stats?${qs.toString()}`).then((r) => r.json()),
      fetch('/api/streamers').then((r) => r.json()),
    ])
      .then(([s, str]) => {
        if (cancelled) return;
        setStats(s);
        setStreamers(str.streamers ?? []);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const totalShare = stats?.totalRevenue ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your streamer-driven sales.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeBar preset={preset} onChange={setPreset} />
          <Button asChild variant="outline" size="sm">
            <a
              href={buildExportUrl('xlsx', range)}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="size-4" /> Excel
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={buildExportUrl('csv', range)} target="_blank" rel="noreferrer">
              CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total orders"
          value={stats?.totalOrders ?? 0}
          icon={ShoppingBag}
          loading={loading}
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          icon={Banknote}
          loading={loading}
        />
        <StatCard
          title="Active streamers"
          value={stats?.streamerCount ?? 0}
          icon={Users}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> Orders over time
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {loading || !stats ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.series} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Streamers leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4">Streamer</th>
                <th className="py-2 pr-4">Ref</th>
                <th className="py-2 pr-4">Orders</th>
                <th className="py-2 pr-4">Revenue</th>
                <th className="py-2 pr-4">Share</th>
              </tr>
            </thead>
            <tbody>
              {(streamers ?? []).map((s) => {
                const share = totalShare > 0 ? (Number(s.revenue) / totalShare) * 100 : 0;
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{s.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        ?ref={s.ref_code}
                      </code>
                    </td>
                    <td className="py-3 pr-4">{s.orders_count}</td>
                    <td className="py-3 pr-4">{formatCurrency(Number(s.revenue))}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(share, 100).toFixed(1)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {share.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {streamers && streamers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No streamers yet — add your first one in the Streamers tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-primary" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold tracking-tight">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function buildExportUrl(format: 'xlsx' | 'csv', range: { from?: Date; to?: Date }) {
  const qs = new URLSearchParams({ format });
  if (range.from) qs.set('from', range.from.toISOString());
  if (range.to) qs.set('to', range.to.toISOString());
  return `/api/export?${qs.toString()}`;
}
