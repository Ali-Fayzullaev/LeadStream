import Link from 'next/link';
import { Download } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { OrdersTable, type OrderRow } from '@/components/admin/orders-table';
import { AutoDistributeButton } from '@/components/admin/auto-distribute-button';
import { getOrderStatuses } from '@/lib/statuses';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

interface SP {
  page?: string;
  status?: string;
  streamer?: string;
  q?: string;
  from?: string;
  to?: string;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: SP }) {
  const admin = createAdminClient();
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from('orders')
    .select(
      'id, customer_name, customer_phone, product_name, quantity, amount, status, ref_code_snapshot, streamer_id, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams?.status && searchParams.status !== '') {
    query = query.eq('status', searchParams.status);
  }
  if (searchParams?.streamer) {
    query = query.eq('streamer_id', searchParams.streamer);
  }
  if (searchParams?.q) {
    const q = `%${searchParams.q}%`;
    query = query.or(`customer_name.ilike.${q},customer_phone.ilike.${q},product_name.ilike.${q}`);
  }
  if (searchParams?.from) query = query.gte('created_at', searchParams.from);
  if (searchParams?.to) query = query.lte('created_at', `${searchParams.to}T23:59:59`);

  // Streamers list — used for both the filter dropdown and name lookup.
  const [{ data: rawRows, count }, { data: streamers }, statuses] = await Promise.all([
    query,
    admin
      .from('streamers')
      .select('id, display_name, ref_code, avatar_url')
      .order('display_name', { ascending: true }),
    getOrderStatuses(),
  ]);

  const streamerNameMap = new Map(
    (streamers ?? []).map((s) => [s.id, s.display_name]),
  );
  const streamerAvatarMap = new Map(
    (streamers ?? []).map((s) => [s.id, (s as { avatar_url?: string | null }).avatar_url ?? null]),
  );

  type Raw = {
    id: string;
    customer_name: string;
    customer_phone: string;
    product_name: string;
    quantity: number;
    amount: number;
    status: OrderRow['status'];
    ref_code_snapshot: string | null;
    streamer_id: string | null;
    created_at: string;
  };

  const rows: OrderRow[] = ((rawRows ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    product_name: r.product_name,
    quantity: r.quantity,
    amount: Number(r.amount),
    status: r.status,
    streamer_name: r.streamer_id ? (streamerNameMap.get(r.streamer_id) ?? null) : null,
    streamer_avatar: r.streamer_id ? (streamerAvatarMap.get(r.streamer_id) ?? null) : null,
    ref_code_snapshot: r.ref_code_snapshot,
    created_at: r.created_at,
  }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build export URL preserving filters.
  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (k !== 'page' && v) exportParams.set(k, v);
  }
  const exportHref = `/api/admin/orders/export${exportParams.toString() ? `?${exportParams}` : ''}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Заказы"
        description={`${total} заказов найдено.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AutoDistributeButton />
            <Button asChild variant="outline">
              <a href={exportHref}>
                <Download className="size-4" />
                Export XLSX
              </a>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-5">
            <select name="status" defaultValue={searchParams?.status ?? ''}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Любой статус</option>
              {statuses.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select name="streamer" defaultValue={searchParams?.streamer ?? ''}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Любой стример</option>
              {(streamers ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.display_name} ({s.ref_code})</option>
              ))}
            </select>
            <Input name="q" placeholder="Имя / телефон / товар" defaultValue={searchParams?.q ?? ''} />
            <Input name="from" type="date" defaultValue={searchParams?.from ?? ''} />
            <Input name="to" type="date" defaultValue={searchParams?.to ?? ''} />
            <div className="md:col-span-5 flex gap-2">
              <Button type="submit">Применить</Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/admin/orders">Сбросить</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <OrdersTable rows={rows} statuses={statuses} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Страница {page} из {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link className="rounded-md border px-3 py-1.5 hover:bg-accent" href={buildUrl(searchParams, page - 1)}>← Назад</Link>
            )}
            {page < totalPages && (
              <Link className="rounded-md border px-3 py-1.5 hover:bg-accent" href={buildUrl(searchParams, page + 1)}>Далее →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildUrl(sp: SP, page: number) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp ?? {})) if (k !== 'page' && v) p.set(k, v);
  p.set('page', String(page));
  return `/admin/orders?${p}`;
}
