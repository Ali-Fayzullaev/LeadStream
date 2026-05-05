import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { OrderStatusUpdater } from '@/components/manager/order-status-updater';
import { getOrderStatuses } from '@/lib/statuses';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface SP {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
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

  const { data: manager } = await supabase
    .from('managers')
    .select('id, display_name, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!manager) redirect('/manager/login');
  if (manager.status === 'blocked') redirect('/manager/blocked');

  // Manager only sees their assigned orders (RLS + explicit filter)
  let q = supabase
    .from('manager_orders')
    .select(
      'id, created_at, customer_name, customer_phone, product_name, quantity, amount, status, streamer_name',
    )
    .eq('assigned_manager_id', manager.id)
    .order('created_at', { ascending: false });

  if (searchParams?.status && searchParams.status !== '') {
    q = q.eq('status', searchParams.status);
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

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-5">
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
            <Input
              name="q"
              placeholder="Имя / телефон / товар"
              defaultValue={searchParams?.q ?? ''}
            />
            <Input name="from" type="date" defaultValue={searchParams?.from ?? ''} />
            <Input name="to" type="date" defaultValue={searchParams?.to ?? ''} />
            <div className="flex gap-2">
              <Button type="submit">Применить</Button>
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
                    <th className="text-left px-4 py-2 font-medium">Статус</th>
                    <th className="text-left px-4 py-2 font-medium">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const s = statusMap.get(o.status);
                    return (
                      <tr key={o.id} className="border-t hover:bg-muted/50">
                        <td className="px-4 py-2 font-medium">{o.customer_name}</td>
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
