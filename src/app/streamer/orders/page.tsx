import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { getOrderStatuses } from '@/lib/statuses';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function StreamerOrdersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/streamer/login');

  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: rows, count }, statuses] = await Promise.all([
    supabase
      .from('streamer_orders')
      .select('id, customer_name, customer_phone_masked, product_name, quantity, amount, status, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(from, to),
    getOrderStatuses(),
  ]);

  const statusMap = new Map(statuses.map((s) => [s.key, s]));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Заказы</h1>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? 'заказ' : total >= 2 && total <= 4 ? 'заказа' : 'заказов'} привязано к вам. Номер телефона скрыт.
        </p>
      </div>

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
                    <th className="text-left px-4 py-2 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const s = statusMap.get(r.status);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">{r.customer_name}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.customer_phone_masked}</td>
                        <td className="px-4 py-2">{r.product_name}</td>
                        <td className="px-4 py-2 text-right">{r.quantity}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(Number(r.amount))}</td>
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
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">
              Заказов пока нет.
            </p>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Страница {page} из {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a className="rounded-md border px-3 py-1.5 hover:bg-accent" href={`?page=${page - 1}`}>← Назад</a>
            )}
            {page < totalPages && (
              <a className="rounded-md border px-3 py-1.5 hover:bg-accent" href={`?page=${page + 1}`}>Далее →</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
