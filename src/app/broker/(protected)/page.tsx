import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrokerOrderStatusUpdater } from '@/components/broker/order-status-updater';
import { OrderCommentsThread } from '@/components/order-comments-thread';
import { getOrderStatuses } from '@/lib/statuses';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BrokerDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/broker/login');

  // Auth verified — use admin client to bypass RLS on orders for joins.
  // We always filter by broker.id below so a broker only ever sees their own leads.
  const admin = createAdminClient();

  const { data: broker } = await admin
    .from('brokers')
    .select('id, display_name, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!broker) redirect('/broker/login');
  if (broker.status === 'blocked') redirect('/broker/blocked');

  // Pull leads assigned to this broker (broker_orders is a view that joins
  // streamer / manager / city names with security_invoker = on).
  const { data: orders, error } = await admin
    .from('broker_orders')
    .select(
      'id, customer_name, customer_phone, status, city_name, created_at, product_name, amount, streamer_name, manager_name',
    )
    .eq('assigned_broker_id', broker.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[broker dashboard] view error:', error.message);
  }

  const statuses = await getOrderStatuses();
  const statusMap = new Map(statuses.map((s) => [s.key, s]));

  const all = orders ?? [];

  // Pre-fetch comment counts for the badge.
  const orderIds = all.map((o) => o.id as string);
  const commentCountMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: cc } = await admin
      .from('order_comments')
      .select('order_id')
      .in('order_id', orderIds);
    for (const row of cc ?? []) {
      const id = row.order_id as string;
      commentCountMap.set(id, (commentCountMap.get(id) ?? 0) + 1);
    }
  }
  const newCount = all.filter((o) => o.status === 'new').length;
  const doneCount = all.filter((o) => o.status === 'completed').length;
  const cancelCount = all.filter((o) => o.status === 'cancelled').length;
  const totalAmount = all.reduce((sum, o) => sum + Number(o.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Добро пожаловать, ${broker.display_name}`}
        description={`Вам назначено лидов: ${all.length}`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Всего лидов" value={all.length} />
        <StatCard label="Новых" value={newCount} color="blue" />
        <StatCard label="Выполнено" value={doneCount} color="green" />
        <StatCard label="Отменено" value={cancelCount} color="red" />
      </div>

      {totalAmount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Сумма по всем лидам:</span>
              <span className="text-2xl font-bold">{formatCurrency(totalAmount)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ваши лиды</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Клиент</th>
                  <th className="text-left px-4 py-2 font-medium">Телефон</th>
                  <th className="text-left px-4 py-2 font-medium">Город</th>
                  <th className="text-left px-4 py-2 font-medium">Товар</th>
                  <th className="text-left px-4 py-2 font-medium">Сумма</th>
                  <th className="text-left px-4 py-2 font-medium">От стримера</th>
                  <th className="text-left px-4 py-2 font-medium">Менеджер</th>
                  <th className="text-center px-4 py-2 font-medium">Статус</th>
                  <th className="text-right px-4 py-2 font-medium">Дата</th>
                  <th className="text-right px-4 py-2 font-medium">Комм.</th>
                </tr>
              </thead>
              <tbody>
                {all.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground">
                      <p className="font-medium">Лиды пока не назначены</p>
                      <p className="text-xs mt-1">Менеджер назначит вам клиентов — они появятся здесь.</p>
                    </td>
                  </tr>
                ) : (
                  all.map((o) => {
                    const s = statusMap.get(o.status);
                    return (
                      <tr key={o.id} className="border-t hover:bg-muted/50">
                        <td className="px-4 py-2 font-medium">{o.customer_name || '—'}</td>
                        <td className="px-4 py-2 font-mono text-xs">
                          <a
                            href={`tel:${o.customer_phone}`}
                            className="text-primary hover:underline"
                          >
                            {o.customer_phone}
                          </a>
                        </td>
                        <td className="px-4 py-2 text-sm">{o.city_name || '—'}</td>
                        <td className="px-4 py-2 text-sm">{o.product_name}</td>
                        <td className="px-4 py-2 font-semibold">
                          {formatCurrency(Number(o.amount ?? 0))}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {o.streamer_name ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {o.manager_name ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {s ? (
                            <BrokerOrderStatusUpdater
                              orderId={o.id}
                              currentStatus={o.status}
                              currentStatusLabel={s.label}
                              currentStatusColor={s.color}
                              availableStatuses={statuses.map((st) => ({
                                key: st.key,
                                label: st.label,
                                color: st.color,
                              }))}
                            />
                          ) : (
                            <Badge variant="secondary">{o.status}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <OrderCommentsThread
                            orderId={o.id}
                            iconOnly
                            initialCount={commentCountMap.get(o.id) ?? 0}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
  };
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${color ? colorMap[color] : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
