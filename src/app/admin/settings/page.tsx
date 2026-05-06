import Link from 'next/link';
import { redirect } from 'next/navigation';
import { User, Tag, Image as ImageIcon, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { getAppSettings } from '@/lib/settings';
import { ProfileSection } from './profile-section';
import { PasswordSection } from './password-section';
import { StatusesSection } from './statuses-section';
import { SiteSection } from './site-section';
import { CitiesSection } from './cities-section';

export const dynamic = 'force-dynamic';

interface SP {
  tab?: string;
}

export default async function AdminSettingsPage({ searchParams }: { searchParams: SP }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/login');

  const admin = createAdminClient();
  const { data: statuses } = await admin
    .from('order_statuses')
    .select('key, label, color, sort_order, is_system')
    .order('sort_order', { ascending: true });

  const settings = await getAppSettings();

  const tab =
    searchParams?.tab === 'statuses' ? 'statuses'
    : searchParams?.tab === 'site' ? 'site'
    : searchParams?.tab === 'cities' ? 'cities'
    : 'profile';

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Настройки" description="Профиль администратора и конфигурация системы" />

      <div className="border-b flex gap-1 overflow-x-auto">
        <TabLink active={tab === 'profile'}  href="/admin/settings?tab=profile"  icon={<User className="size-4" />}     label="Профиль" />
        <TabLink active={tab === 'site'}     href="/admin/settings?tab=site"     icon={<ImageIcon className="size-4" />} label="Сайт" />
        <TabLink active={tab === 'statuses'} href="/admin/settings?tab=statuses" icon={<Tag className="size-4" />}      label="Статусы заказов" />
        <TabLink active={tab === 'cities'}   href="/admin/settings?tab=cities"   icon={<MapPin className="size-4" />}   label="Города" />
      </div>

      {tab === 'profile' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Профиль</CardTitle>
              <CardDescription>Имя и email для отображения в админке</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileSection email={profile.email} fullName={profile.full_name ?? ''} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Смена пароля</CardTitle>
              <CardDescription>Используйте надёжный пароль не короче 8 символов</CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordSection />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'site' && (
        <Card>
          <CardHeader>
            <CardTitle>Брендинг</CardTitle>
            <CardDescription>Имя сайта и логотип — используются везде (сайдбар, лендинг, вкладка браузера).</CardDescription>
          </CardHeader>
          <CardContent>
            <SiteSection siteName={settings.site_name} logoUrl={settings.logo_url} />
          </CardContent>
        </Card>
      )}

      {tab === 'statuses' && (
        <Card>
          <CardHeader>
            <CardTitle>Статусы заказов</CardTitle>
            <CardDescription>
              Настраиваемые статусы с цветами. Системные статусы можно переименовывать, но нельзя удалять.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <StatusesSection statuses={statuses ?? []} />
          </CardContent>
        </Card>
      )}

      {tab === 'cities' && <CitiesSection />}
    </div>
  );
}

function TabLink({ active, href, icon, label }: { active: boolean; href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}