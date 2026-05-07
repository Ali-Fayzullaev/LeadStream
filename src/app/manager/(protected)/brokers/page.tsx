import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import { listMyBrokersAction } from '@/app/broker/actions';
import { CreateBrokerForm } from '@/components/manager/create-broker-form';
import { BrokerActions } from '@/components/manager/broker-actions';

export const dynamic = 'force-dynamic';

export default async function ManagerBrokersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const result = await listMyBrokersAction();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Мои брокеры" description="Управление брокерами вашей команды" />
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 size-4" />Добавить брокера</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить нового брокера</DialogTitle>
              <DialogDescription>Брокер получит доступ к системе и будет видеть только свои лиды.</DialogDescription>
            </DialogHeader>
            <CreateBrokerForm />
          </DialogContent>
        </Dialog>
      </div>

      {!result.success ? (
        <Card><CardContent className="pt-6"><p className="text-destructive">{result.error}</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Брокеры ({result.brokers?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Имя</th>
                    <th className="text-left px-4 py-2 font-medium">Email</th>
                    <th className="text-left px-4 py-2 font-medium">Телефон</th>
                    <th className="text-left px-4 py-2 font-medium">Пароль</th>
                    <th className="text-center px-4 py-2 font-medium">Активных лидов</th>
                    <th className="text-center px-4 py-2 font-medium">Telegram</th>
                    <th className="text-center px-4 py-2 font-medium">Статус</th>
                    <th className="text-right px-4 py-2 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {(result.brokers ?? []).length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Брокеры не найдены</td></tr>
                  ) : (result.brokers ?? []).map((b) => (
                    <tr key={String(b.id)} className="border-t hover:bg-muted/50">
                      <td className="px-4 py-2 font-medium">{String(b.display_name)}</td>
                      <td className="px-4 py-2 text-sm">{String(b.email)}</td>
                      <td className="px-4 py-2 text-sm font-mono">{b.phone ? String(b.phone) : '—'}</td>
                      <td className="px-4 py-2 text-sm font-mono text-muted-foreground">
                        {b.temp_password ? String(b.temp_password) : '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge variant="secondary">{Number(b.activeOrders ?? 0)}</Badge>
                      </td>
                      <td className="px-4 py-2 text-center text-xs">
                        {b.telegram_chat_id ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700">✓ Настроен</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Не настроен</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={
                          b.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' :
                          b.status === 'blocked' ? 'bg-red-500/10 text-red-700' :
                          'bg-yellow-500/10 text-yellow-700'
                        }>
                          {b.status === 'active' ? 'Активен' : b.status === 'blocked' ? 'Заблокирован' : 'Неактивен'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <BrokerActions
                          brokerId={String(b.id)}
                          brokerName={String(b.display_name)}
                          currentStatus={(b.status as 'active' | 'inactive' | 'blocked') ?? 'inactive'}
                          activeOrdersCount={Number(b.activeOrders ?? 0)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
