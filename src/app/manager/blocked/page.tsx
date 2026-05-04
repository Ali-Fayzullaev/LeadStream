import { redirect } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ManagerBlockedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/manager/login');

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <AlertCircle className="size-16 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Доступ заблокирован</h1>
          <p className="text-muted-foreground">
            Ваш аккаунт был заблокирован администратором. Свяжитесь с администратором для получения более подробной информации.
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            const sb = createClient();
            await sb.auth.signOut();
            redirect('/manager/login');
          }}
        >
          <Button variant="outline" className="w-full">
            Выйти
          </Button>
        </form>
      </div>
    </div>
  );
}
