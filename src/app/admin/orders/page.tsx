import Link from 'next/link';
import { Download, AlertTriangle, Globe2 } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { OrdersTable, type OrderRow } from '@/components/admin/orders-table';
import { AutoDistributeButton } from '@/components/admin/auto-distribute-button';
import { getOrderStatuses } from '@/lib/statuses';
import { getOrderCommentsSummary } from '@/app/actions/order-comments';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

/**
 * "Primary" cities for which dedicated managers exist.
 * Anything else falls into the "Другие города" tab so admin can review +
 * route them manually.
 *
 * NOTE: keep slugs in sync with `supabase/migrations/0024_seed_all_kz_cities.sql`.
 */
const PRIMARY_CITY_SLUGS = ['astana', 'almaty'] as const;

type TabKey = 'all' | 'unassigned' | 'other_cities';

interface SP {
  page?: string;
  status?: string;
  streamer?: string;
  q?: string;
  from?: string;
  to?: string;
  tab?: string;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: SP }) {
  const admin = createAdminClient();
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const tab: TabKey =
    searchParams?.tab === 'unassigned' || searchParams?.tab === 'other_cities'
      ? searchParams.tab
      : 'all';

  // ── Resolve city id sets so we can filter "primary" vs "other" cities ─────
  // PRIMARY = Астана + Алматы (slugs above)
  // OTHER   = everything else (city_id IS NOT NULL AND NOT IN primary)
  const { data: allCities } = await admin
    .from('cities')
    .select('id, name, slug')
    .order('name', { ascending: true });

  const primaryCityIds = new Set(
    (allCities ?? [])
      .filter((c) => (PRIMARY_CITY_SLUGS as readonly string[]).includes(c.slug as string))
      .map((c) => c.id as string),
  );
  const otherCityIds = (allCities ?? [])
    .filter((c) => !primaryCityIds.has(c.id as string))
    .map((c) => c.id as string);

  // ── Counters for tab badges (cheap head-count queries in parallel) ────────
  const [{ count: unassignedCount }, { count: otherCitiesCount }] = await Promise.all([
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .is('city_id', null),
    otherCityIds.length > 0
      ? admin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('city_id', otherCityIds)
      : Promise.resolve({ count: 0 } as { count: number }),
  ]);

  // ── Main listing query ────────────────────────────────────────────────────
  let query = admin
    .from('orders')
    .select(
      'id, customer_name, customer_phone, product_name, quantity, amount, status, ref_code_snapshot, streamer_id, city_id, assigned_manager_id, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (tab === 'unassigned') {
    // Клиент НЕ выбрал город — самые "сирые" заявки
    query = query.is('city_id', null);
  } else if (tab === 'other_cities') {
    // Клиент выбрал город, но это не Астана/Алматы
    if (otherCityIds.length > 0) {
      query = query.in('city_id', otherCityIds);
    } else {
      // No other cities yet — return empty result
      query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
  }

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
  const cityNameMap = new Map(
    (allCities ?? []).map((c) => [c.id as string, c.name as string]),
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
    city_id: string | null;
    assigned_manager_id: string | null;
    created_at: string;
  };

  // Pre-fetch comment count + last-comment-preview so each row shows
  // both a badge AND an inline message preview without needing the user
  // to open the dialog. One round-trip for all rows on the page.
  const orderIds = (rawRows ?? []).map((r) => r.id as string);
  const commentSummary = await getOrderCommentsSummary(orderIds);

  const rows: OrderRow[] = ((rawRows ?? []) as unknown as Raw[]).map((r) => {
    const summary = commentSummary.get(r.id);
    return {
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
      city_id: r.city_id,
      city_name: r.city_id ? (cityNameMap.get(r.city_id) ?? null) : null,
      is_assigned: r.assigned_manager_id !== null,
      comments_count: summary?.count ?? 0,
      last_comment: summary?.last ?? null,
    };
  });

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (k !== 'page' && v) exportParams.set(k, v);
  }
  const exportHref = `/api/admin/orders/export${exportParams.toString() ? `?${exportParams}` : ''}`;

  // Helpers to keep tab links idempotent
  const tabHref = (t: TabKey): string => (t === 'all' ? '/admin/orders' : `/admin/orders?tab=${t}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Заявки"
        description={`${total} заявок найдено.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AutoDistributeButton />
            <Button asChild variant="outline">
              <a href={exportHref}>
                <Download className="size-4 mr-2" />
                Export XLSX
              </a>
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b">
        <Link
          href={tabHref('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Все заявки
        </Link>

        <Link
          href={tabHref('unassigned')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'unassigned'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="size-3.5" />
          Неопределённые
          {(unassignedCount ?? 0) > 0 && (
            <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs px-1.5 py-0">
              {unassignedCount}
            </Badge>
          )}
        </Link>

        <Link
          href={tabHref('other_cities')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'other_cities'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe2 className="size-3.5" />
          Другие города
          {(otherCitiesCount ?? 0) > 0 && (
            <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs px-1.5 py-0">
              {otherCitiesCount}
            </Badge>
          )}
        </Link>
      </div>

      {/* Tab info banners */}
      {tab === 'unassigned' && (
        <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Неопределённые заявки
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Клиент <b>не выбрал город</b> на форме. Назначьте город вручную —
              заявка автоматически перейдёт менеджеру по этому городу (если он есть).
            </p>
          </div>
        </div>
      )}

      {tab === 'other_cities' && (
        <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-4 flex items-start gap-3">
          <Globe2 className="size-5 text-sky-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-sky-700 dark:text-sky-400">
              Другие города (не Астана/Алматы)
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Клиент выбрал город, для которого пока нет назначенного менеджера.
              Заявки лежат у вас — обработайте лично или назначьте менеджеру.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-5">
            {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
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
                <Link href={tabHref(tab)}>Сбросить</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <OrdersTable rows={rows} statuses={statuses} cities={allCities ?? []} />

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

// Comment count + last-comment preview now come from a single helper —
// `getOrderCommentsSummary` in `@/app/actions/order-comments`. We deleted
// the page-local `getCommentCounts` to keep that logic in one place and
// remove the awkward `Map<orderId, number>` shape that no longer matches
// what the UI needs.
