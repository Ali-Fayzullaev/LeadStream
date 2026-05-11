import { redirect } from 'next/navigation';
import { PackageSearch } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { OrderCityPicker } from '@/components/streamer/order-city-picker';
import { getOrderStatuses } from '@/lib/statuses';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function StreamerOrdersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  // 1. Authenticate via the user-scoped client.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2. Resolve the current streamer record so we can scope orders by id.
  //    We need this anyway for the action buttons and so we don't accidentally
  //    show other streamers' rows even if RLS were misconfigured.
  const admin = createAdminClient();
  const { data: streamer } = await admin
    .from('streamers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!streamer) {
    return (
      <div className="space-y-6">
        <PageHeader title="Заказы" description="Заявки по вашей реферальной ссылке." />
        <EmptyState
          icon={PackageSearch}
          title="Профиль стримера не найден"
          description="Обратитесь к администратору."
        />
      </div>
    );
  }

  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // 3. Query the `orders` base table directly via the admin client and
  //    filter by `streamer_id`. Why not the `streamer_orders` view? Because:
  //      - the view's schema has evolved across migrations (mask/no-mask,
  //        with/without city) and on some environments may not yet expose
  //        all the columns we need;
  //      - reading the base table with an explicit `streamer_id = ME`
  //        filter is just as safe (we double-checked the streamer above
  //        from the JWT) and gives us a stable, well-known column set.
  //    We also fetch the list of active cities so the inline picker on
  //    "city not set yet" rows has options.
  const [{ data: rows, count }, statuses, { data: cities }] = await Promise.all([
    admin
      .from('orders')
      .select(
        'id, customer_name, customer_phone, product_name, quantity, amount, status, city_id, created_at',
        { count: 'exact' },
      )
      .eq('streamer_id', streamer.id)
      .order('created_at', { ascending: false })
      .range(from, to),
    getOrderStatuses(),
    admin.from('cities').select('id, name').eq('is_active', true).order('name'),
  ]);

  const cityOptions = (cities ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
  }));
  const cityNameById = new Map<string, string>(cityOptions.map((c) => [c.id, c.name]));

  const statusMap = new Map(statuses.map((s) => [s.key, s]));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unassignedCount = (rows ?? []).filter((r) => !r.city_id).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Заказы"
        description={`${total} ${total === 1 ? 'заказ' : total >= 2 && total <= 4 ? 'заказа' : 'заказов'} привязано к вам.`}
      />

      {unassignedCount > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          ⚠️ У вас <b>{unassignedCount}</b>{' '}
          {unassignedCount === 1 ? 'неопределённая заявка' : 'неопределённых заявок'} без города.
          Укажите город — заявка автоматически попадёт менеджеру и брокеру.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Все заказы</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows && rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Дата</th>
                    <th className="text-left px-4 py-2 font-medium">Клиент</th>
                    <th className="text-left px-4 py-2 font-medium">Телефон</th>
                    <th className="text-left px-4 py-2 font-medium">Товар</th>
                    <th className="text-right px-4 py-2 font-medium">Кол-во</th>
                    <th className="text-right px-4 py-2 font-medium">Сумма</th>
                    <th className="text-left px-4 py-2 font-medium">Город</th>
                    <th className="text-left px-4 py-2 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const s = statusMap.get(r.status);
                    const cityName = r.city_id ? cityNameById.get(r.city_id) ?? '—' : null;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">{r.customer_name ?? '—'}</td>
                        <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                          {r.customer_phone}
                        </td>
                        <td className="px-4 py-2">{r.product_name}</td>
                        <td className="px-4 py-2 text-right">{r.quantity}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(Number(r.amount))}
                        </td>
                        <td className="px-4 py-2">
                          {r.city_id ? (
                            <span className="text-xs">{cityName}</span>
                          ) : (
                            <OrderCityPicker orderId={r.id} cities={cityOptions} />
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {s ? (
                            <StatusBadge label={s.label} color={s.color} />
                          ) : (
                            <span className="text-xs text-muted-foreground">{r.status}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Заказов пока нет"
              description="Поделитесь вашей реферальной ссылкой — первые заказы появятся здесь."
            />
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Страница {page} из {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
                href={`?page=${page - 1}`}
              >
                ← Назад
              </a>
            )}
            {page < totalPages && (
              <a
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
                href={`?page=${page + 1}`}
              >
                Далее →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
