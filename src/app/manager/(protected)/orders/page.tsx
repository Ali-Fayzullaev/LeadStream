import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { OrderStatusUpdater } from '@/components/manager/order-status-updater';
import { BrokerAssigner } from '@/components/manager/broker-assigner';
import { OrderCommentsThread } from '@/components/order-comments-thread';
import { getOrderStatuses } from '@/lib/statuses';
import { formatCurrency } from '@/lib/utils';
import { getOrderCommentsSummary } from '@/app/actions/order-comments';

export const dynamic = 'force-dynamic';

interface SP {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  broker?: string; // broker id to filter by, or 'none' for unassigned
}

export default async function ManagerOrdersPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/manager/login');

  // Auth verified above — admin client bypasses RLS for joins.
  // We always filter by manager.id so a manager only sees their own orders.
  const admin = createAdminClient();

  const { data: manager } = await admin
    .from('managers')
    .select('id, display_name, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!manager) redirect('/manager/login');
  if (manager.status === 'blocked') redirect('/manager/blocked');

  // Manager's own brokers (for filter dropdown)
  const { data: brokers } = await admin
    .from('brokers')
    .select('id, display_name')
    .eq('manager_id', manager.id)
    .order('display_name', { ascending: true });

  let q = admin
    .from('manager_orders')
    .select(
      'id, created_at, customer_name, customer_phone, product_name, quantity, amount, status, streamer_name, assigned_broker_id',
    )
    .eq('assigned_manager_id', manager.id)
    .order('created_at', { ascending: false });

  if (searchParams?.status && searchParams.status !== '') {
    q = q.eq('status', searchParams.status);
  }
  if (searchParams?.broker) {
    if (searchParams.broker === 'none') {
      q = q.is('assigned_broker_id', null);
    } else {
      q = q.eq('assigned_broker_id', searchParams.broker);
    }
  }
  if (searchParams?.q) {
    const like = `%${searchParams.q}%`;
    q = q.or(
      `customer_name.ilike.${like},customer_phone.ilike.${like},product_name.ilike.${like}`,
    );
  }
  if (searchParams?.from) q = q.gte('created_at', searchParams.from);
  if (searchParams?.to) q = q.lte('created_at', `${searchParams.to}T23:59:59`);

  const [{ data: orders }, statuses] = await Promise.all([q, getOrderStatuses()]);

  // Pre-fetch comment count + last-comment preview in one round trip so
  // the manager can read the latest message right in the table without
  // opening the dialog.
  const orderIds = (orders ?? []).map((o) => o.id as string);
  const commentSummary = await getOrderCommentsSummary(orderIds);

  const brokerNameMap = new Map(
    (brokers ?? []).map((b) => [b.id as string, b.display_name as string]),
  );

  const statusMap = new Map(statuses.map((s) => [s.key, s]));
  const allStatusOptions = statuses.map((st) => ({
    key: st.key,
    label: st.label,
    color: st.color,
  }));

  const total = orders?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Мои заявки"
        description={`Всего: ${total}. Управляйте статусами назначенных вам заявок.`}
      />

      {/* Quick broker filter chips */}
      {brokers && brokers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Брокер:</span>
          <Link
            href={buildHref(searchParams, { broker: undefined })}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              !searchParams?.broker
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent'
            }`}
          >
            Все
          </Link>
          {brokers.map((b) => (
            <Link
              key={b.id}
              href={buildHref(searchParams, { broker: b.id })}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                searchParams?.broker === b.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent'
              }`}
            >
              {b.display_name}
            </Link>
          ))}
          <Link
            href={buildHref(searchParams, { broker: 'none' })}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              searchParams?.broker === 'none'
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-background hover:bg-accent text-orange-600'
            }`}
          >
            Без брокера
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-6">
            <select
              name="status"
              defaultValue={searchParams?.status ?? ''}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Любой статус</option>
              {statuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              name="broker"
              defaultValue={searchParams?.broker ?? ''}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Любой брокер</option>
              <option value="none">— Без брокера —</option>
              {(brokers ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name}
                </option>
              ))}
            </select>

            <Input
              name="q"
              placeholder="Имя / телефон / товар"
              defaultValue={searchParams?.q ?? ''}
            />
            <Input name="from" type="date" defaultValue={searchParams?.from ?? ''} />
            <Input name="to" type="date" defaultValue={searchParams?.to ?? ''} />
            <div className="flex gap-2">
              <Button type="submit" className="w-full">Применить</Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/manager/orders">Сбросить</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Список заявок</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Клиент</th>
                    <th className="text-left px-4 py-2 font-medium">Телефон</th>
                    <th className="text-left px-4 py-2 font-medium">Товар</th>
                    <th className="text-left px-4 py-2 font-medium">Кол-во</th>
                    <th className="text-left px-4 py-2 font-medium">Сумма</th>
                    <th className="text-left px-4 py-2 font-medium">От стримера</th>
                    <th className="text-left px-4 py-2 font-medium">Брокер</th>
                    <th className="text-left px-4 py-2 font-medium">Статус</th>
                    <th className="text-left px-4 py-2 font-medium">Дата</th>
                    <th className="text-right px-4 py-2 font-medium">Комм.</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const s = statusMap.get(o.status);
                    const brokerName = o.assigned_broker_id
                      ? brokerNameMap.get(o.assigned_broker_id) ?? '—'
                      : null;
                    return (
                      <tr key={o.id} className="border-t hover:bg-muted/50">
                        <td className="px-4 py-2 font-medium">{o.customer_name ?? '—'}</td>
                        <td className="px-4 py-2 font-mono text-xs">
                          <a
                            href={`tel:${o.customer_phone}`}
                            className="text-primary hover:underline"
                          >
                            {o.customer_phone}
                          </a>
                        </td>
                        <td className="px-4 py-2">{o.product_name}</td>
                        <td className="px-4 py-2 text-center">{o.quantity}</td>
                        <td className="px-4 py-2 font-semibold">
                          {formatCurrency(Number(o.amount))}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {o.streamer_name ?? 'Прямой заход'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <BrokerAssigner
                            orderId={o.id}
                            currentBrokerId={o.assigned_broker_id ?? null}
                            currentBrokerName={brokerName}
                            brokers={brokers ?? []}
                          />
                        </td>
                        <td className="px-4 py-2">
                          {s ? (
                            <OrderStatusUpdater
                              orderId={o.id}
                              currentStatus={o.status}
                              currentStatusLabel={s.label}
                              currentStatusColor={s.color}
                              availableStatuses={allStatusOptions}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{o.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {new Date(o.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-2 py-2 text-right align-top">
                          <OrderCommentsThread
                            orderId={o.id}
                            iconOnly
                            initialCount={commentSummary.get(o.id)?.count ?? 0}
                            lastComment={commentSummary.get(o.id)?.last ?? null}
                            previewLayout="block"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p>Нет заявок по указанным фильтрам</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildHref(sp: SP, patch: Partial<SP>) {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = { ...sp, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== '') params.set(k, v);
  }
  const qs = params.toString();
  return `/manager/orders${qs ? `?${qs}` : ''}`;
}
