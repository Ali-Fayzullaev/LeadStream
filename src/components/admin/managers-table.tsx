'use client';

import { useState } from 'react';
import { updateManagerStatusAction, deleteManagerAction } from '@/app/manager/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Loader2, Check, Copy, Eye, EyeOff, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Manager {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone: string | null;
  status: string;
  distribution_count: number;
  temp_password?: string | null;
  created_at: string;
  activeOrders?: number;
  city_name?: string | null;
}

interface ManagersTableProps {
  managers: Manager[];
}

function PasswordCell({ password }: { password?: string | null }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!password) return <span className="text-xs text-muted-foreground">—</span>;

  const copy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Пароль скопирован');
    });
  };

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs select-all">
        {visible ? password : '••••••••••'}
      </span>
      <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0"
        onClick={() => setVisible(v => !v)} title={visible ? 'Скрыть' : 'Показать'}>
        {visible ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0"
        onClick={copy} title="Копировать пароль">
        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
      </Button>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  active:   'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  inactive: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  blocked:  'bg-red-500/10 text-red-700 dark:text-red-400',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Активен', inactive: 'Неактивен', blocked: 'Заблокирован',
};

export function ManagersTable({ managers }: ManagersTableProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleStatusChange = async (id: string, status: 'active' | 'inactive' | 'blocked') => {
    setLoading(id);
    const res = await updateManagerStatusAction(id, status);
    setLoading(null);
    if (!res.success) toast.error(res.error ?? 'Ошибка обновления статуса');
    else toast.success('Статус обновлён');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteManagerAction(deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (!res.success) toast.error(res.error ?? 'Ошибка удаления');
    else toast.success('Менеджер удалён');
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">ФИО</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Телефон</th>
              <th className="text-left px-4 py-3 font-medium">Город</th>
              <th className="text-left px-4 py-3 font-medium">Пароль</th>
              <th className="text-center px-4 py-3 font-medium">Активных</th>
              <th className="text-center px-4 py-3 font-medium">Всего</th>
              <th className="text-center px-4 py-3 font-medium">Статус</th>
              <th className="text-right px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {managers.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted-foreground">
                  Менеджеры не найдены. Добавьте первого менеджера.
                </td>
              </tr>
            ) : managers.map(m => (
              <tr key={m.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{m.display_name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{m.email}</td>
                <td className="px-4 py-3 text-sm font-mono">{m.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  {m.city_name ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      <MapPin className="size-3" />
                      {m.city_name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <PasswordCell password={m.temp_password} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant="secondary">{m.activeOrders ?? 0}</Badge>
                </td>
                <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                  {m.distribution_count ?? 0}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge className={STATUS_COLOR[m.status] ?? 'bg-muted text-muted-foreground'}>
                    {STATUS_LABEL[m.status] ?? m.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={loading === m.id} className="size-8 p-0">
                        {loading === m.id
                          ? <Loader2 className="size-4 animate-spin" />
                          : <MoreHorizontal className="size-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {m.status !== 'active' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(m.id, 'active')}>
                          <Check className="mr-2 size-4 text-emerald-500" />
                          Активировать
                        </DropdownMenuItem>
                      )}
                      {m.status !== 'inactive' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(m.id, 'inactive')}>
                          Деактивировать
                        </DropdownMenuItem>
                      )}
                      {m.status !== 'blocked' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(m.id, 'blocked')}
                          className="text-destructive"
                        >
                          Заблокировать
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(m.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить менеджера?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Менеджер будет удалён из системы вместе с аккаунтом.
              Заявки останутся, но будут без менеджера.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
