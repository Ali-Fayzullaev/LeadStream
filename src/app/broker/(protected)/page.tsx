import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function BrokerDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: broker } = await supabase
    .from('brokers')
    .select('id, display_name, status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!broker) redirect('/login');

  const { data: orders } = await supabase
    .from('broker_orders')
    .select('id, customer_name, customer_phone, status, city_name, created_at, product_name')
    .eq('assigned_broker_id', broker.id)
    .order('created_at', { ascending: false });

  const all = orders ?? [];
  const newCount = all.filter(o => o.status === 'new').length;
  const doneCount = all.filter(o => o.status === 'completed').length;
  const cancelCount = all.filter(o => o.status === 'cancelled').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Добро пожаловать, ${broker.display_name}`}
        description="Ваши назначенные лиды"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Всего лидов" value={all.length} />
        <StatCard label="Новых" value={newCount} color="blue" />
        <StatCard label="Выполнено" value={doneCount} color="green" />
        <StatCard label="Отменено" value={cancelCount} color="red" />
      </div>

      <Card>
        <CardHeader><CardTitle>Ваши лиды</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Клиент</th>
                  <th className="text-left px-4 py-2 font-medium">Телефон</th>
                  <th className="text-left px-4 py-2 font-medium">Город</th>
                  <th className="text-left px-4 py-2 font-medium">Товар</th>
                  <th className="text-center px-4 py-2 font-medium">Статус</th>
                  <th className="text-right px-4 py-2 font-medium">Дата</th>
                </tr>
              </thead>
              <tbody>
                {all.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Лиды не найдены</td></tr>
                ) : all.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-muted/50">
                    <td className="px-4 py-2 font-medium">{o.customer_name || '—'}</td>
                    <td className="px-4 py-2 font-mono text-sm">{o.customer_phone}</td>
                    <td className="px-4 py-2 text-sm">{o.city_name || '—'}</td>
                    <td className="px-4 py-2 text-sm">{o.product_name}</td>
                    <td className="px-4 py-2 text-center">
                      <Badge variant="secondary">{o.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
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
