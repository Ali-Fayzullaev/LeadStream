import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ManagersTable } from '@/components/admin/managers-table';
import { CreateManagerForm } from '@/components/admin/create-manager-form';
import { listManagersAction } from '@/app/manager/actions';

export const dynamic = 'force-dynamic';

export default async function AdminManagersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login');

  const result = await listManagersAction();

  if (!result.success) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Менеджеры" description="Управление операторами call-центра" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{result.error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Менеджеры" description="Управление операторами call-центра" />
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Добавить менеджера
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить нового менеджера</DialogTitle>
              <DialogDescription>
                Менеджер получит email с временным паролем для входа в систему.
              </DialogDescription>
            </DialogHeader>
            <CreateManagerForm />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Все менеджеры ({result.managers?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ManagersTable managers={result.managers || []} />
        </CardContent>
      </Card>
    </div>
  );
}
