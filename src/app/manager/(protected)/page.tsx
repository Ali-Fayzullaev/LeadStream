import { redirect } from 'next/navigation';
import { AlertCircle, CheckCircle, Clock, Phone, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { OrderStatusUpdater } from '@/components/manager/order-status-updater';
import { getOrderStatuses } from '@/lib/statuses';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ManagerDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/manager/login');

  // Get manager profile
  const { data: manager } = await supabase
    .from('managers')
    .select('id, display_name, phone, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!manager) redirect('/manager/login');
  if (manager.status === 'blocked') redirect('/manager/blocked');

  // Get manager's assigned orders
  const { data: orders } = await supabase
    .from('manager_orders')
    .select('id, created_at, customer_name, customer_phone_masked, amount, status, streamer_name')
    .eq('assigned_manager_id', manager.id)
    .order('created_at', { ascending: false });

  const statuses = await getOrderStatuses();
  const statusMap = new Map(statuses.map((s) => [s.key, s]));

  // Stats
  const totalOrders = orders?.length ?? 0;
  const newOrders = orders?.filter((o) => o.status === 'new').length ?? 0;
  const completedOrders = orders?.filter((o) => o.status === 'completed').length ?? 0;
  const cancelledOrders = orders?.filter((o) => o.status === 'cancelled').length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Добро пожаловать, ${manager.display_name}`}
        description="Ваши назначенные заявки"
      />

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Всего заявок</p>
              <p className="text-4xl font-bold">{totalOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-blue-500" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Новых</p>
              </div>
              <p className="text-4xl font-bold text-blue-500">{newOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-emerald-500" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Выполнено</p>
              </div>
              <p className="text-4xl font-bold text-emerald-500">{completedOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-red-500" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Отменено</p>
              </div>
              <p className="text-4xl font-bold text-red-500">{cancelledOrders}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders table */}
      <Card>
        <CardHeader>
          <CardTitle>Ваши заявки</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Клиент</th>
                    <th className="text-left px-4 py-2 font-medium">Телефон</th>
                    <th className="text-left px-4 py-2 font-medium">От стримера</th>
                    <th className="text-left px-4 py-2 font-medium">Сумма</th>
                    <th className="text-left px-4 py-2 font-medium">Статус</th>
                    <th className="text-left px-4 py-2 font-medium">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const s = statusMap.get(o.status);
                    const allStatuses = statuses.map((st) => ({
                      key: st.key,
                      label: st.label,
                      color: st.color,
                    }));

                    return (
                      <tr key={o.id} className="border-t hover:bg-muted/50">
                        <td className="px-4 py-2 font-medium">{o.customer_name}</td>
                        <td className="px-4 py-2 font-mono text-xs">
                          <a href={`tel:${o.customer_phone_masked}`} className="text-primary hover:underline">
                            {o.customer_phone_masked}
                          </a>
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {o.streamer_name ?? 'Прямой заход'}
                        </td>
                        <td className="px-4 py-2 font-semibold">{formatCurrency(Number(o.amount))}</td>
                        <td className="px-4 py-2">
                          {s ? (
                            <OrderStatusUpdater
                              orderId={o.id}
                              currentStatus={o.status}
                              currentStatusLabel={s.label}
                              currentStatusColor={s.color}
                              availableStatuses={allStatuses}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{o.status}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p>У вас пока нет назначенных заявок</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
