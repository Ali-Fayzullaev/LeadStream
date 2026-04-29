'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DateRangeBar, presetToRange, type RangePreset } from '../date-range-bar';

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  quantity: number;
  amount: number;
  status: string;
  created_at: string;
  streamer: { id: string; name: string; ref_code: string } | null;
}

interface StreamerOption {
  id: string;
  name: string;
  ref_code: string;
}

export default function OrdersPage() {
  const [preset, setPreset] = useState<RangePreset>('month');
  const [streamerId, setStreamerId] = useState<string>('');
  const [streamers, setStreamers] = useState<StreamerOption[]>([]);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => presetToRange(preset), [preset]);

  useEffect(() => {
    fetch('/api/streamers')
      .then((r) => r.json())
      .then((d) => setStreamers(d.streamers ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams();
    if (range.from) qs.set('from', range.from.toISOString());
    if (range.to) qs.set('to', range.to.toISOString());
    if (streamerId) qs.set('streamerId', streamerId);

    fetch(`/api/orders?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setOrders(d.orders ?? []);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, streamerId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={streamerId}
            onChange={(e) => setStreamerId(e.target.value)}
          >
            <option value="">All streamers</option>
            {streamers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.ref_code})
              </option>
            ))}
          </select>
          <DateRangeBar preset={preset} onChange={setPreset} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{orders?.length ?? 0} orders</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Qty</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Streamer</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                      {formatDate(o.created_at)}
                    </td>
                    <td className="py-3 pr-4 font-medium">{o.customer_name}</td>
                    <td className="py-3 pr-4">
                      <a className="hover:underline" href={`tel:${o.customer_phone}`}>
                        {o.customer_phone}
                      </a>
                    </td>
                    <td className="py-3 pr-4">{o.product_name}</td>
                    <td className="py-3 pr-4">{o.quantity}</td>
                    <td className="py-3 pr-4">{formatCurrency(Number(o.amount))}</td>
                    <td className="py-3 pr-4">
                      {o.streamer ? (
                        <span className="text-xs">
                          {o.streamer.name}{' '}
                          <span className="text-muted-foreground">({o.streamer.ref_code})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">direct</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{o.status}</span>
                    </td>
                  </tr>
                ))}
                {orders && orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      No orders in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
