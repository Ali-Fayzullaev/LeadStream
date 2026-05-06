import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ManagerTelegramSection } from './telegram-section';

export const dynamic = 'force-dynamic';

export default async function ManagerSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: manager } = await admin
    .from('managers')
    .select('id, display_name, email, telegram_chat_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!manager) redirect('/login');

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Настройки" description="Управление вашим профилем и уведомлениями" />

      <Card>
        <CardHeader>
          <CardTitle>Профиль</CardTitle>
          <CardDescription>Ваши данные в системе</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Имя</span>
            <span className="text-sm font-medium">{manager.display_name}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{manager.email}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🔔 Telegram уведомления</CardTitle>
          <CardDescription>
            Получайте новые лиды прямо в личку Telegram — мгновенно, без задержек.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManagerTelegramSection
            managerId={manager.id}
            currentChatId={manager.telegram_chat_id ?? ''}
          />
        </CardContent>
      </Card>
    </div>
  );
}
