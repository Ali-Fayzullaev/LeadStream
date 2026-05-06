import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileForm } from '@/components/streamer/profile-form';
import { TikTokAccountsManager, type TikTokAccount } from '@/components/streamer/tiktok-accounts-manager';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default async function StreamerProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: streamer } = await supabase
    .from('streamers')
    .select('id, display_name, phone, avatar_url, telegram_chat_id, ref_code, commission_percent, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!streamer) redirect('/login');

  const { data: tiktokAccounts } = await supabase
    .from('streamer_tiktok_accounts')
    .select('id, username, is_primary')
    .eq('streamer_id', streamer.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Профиль"
        description="Можно менять личные данные. Реф-код и комиссия управляются админом."
      />

      <Card>
        <CardHeader>
          <CardTitle>Только для чтения</CardTitle>
          <CardDescription>Установлено админом — для изменения обратитесь в поддержку.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <Field label="Email" value={user.email ?? '—'} />
          <Field
            label="Статус"
            value={
              streamer.status === 'active'
                ? 'Активен'
                : streamer.status === 'pending'
                  ? 'Ожидает проверки'
                  : streamer.status === 'blocked'
                    ? 'Заблокирован'
                    : streamer.status
            }
          />
          <Field label="Реф-код" value={streamer.ref_code} mono />
          <Field label="Комиссия" value={`${streamer.commission_percent}%`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TikTok аккаунты</CardTitle>
          <CardDescription>
            Привяжите профили, с которых вы стримите. Можно добавить несколько (до 10).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TikTokAccountsManager accounts={(tiktokAccounts ?? []) as TikTokAccount[]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Редактируемые данные</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              display_name: streamer.display_name,
              phone: streamer.phone ?? '',
              avatar_url: streamer.avatar_url ?? '',
              telegram_chat_id: streamer.telegram_chat_id ?? '',
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono text-sm mt-0.5' : 'text-sm mt-0.5'}>{value}</div>
    </div>
  );
}
