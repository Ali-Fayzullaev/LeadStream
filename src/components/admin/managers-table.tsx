'use client';

import { useState } from 'react';
import { updateManagerStatusAction } from '@/app/manager/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Loader2, Check, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

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
}

interface ManagersTableProps {
  managers: Manager[];
}

function PasswordCell({ password }: { password?: string | null }) {
  const [visible, setVisible] = useState(false);

  if (!password) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const copy = () => {
    navigator.clipboard.writeText(password).then(() => {
      toast.success('Пароль скопирован');
    });
  };

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs select-all">
        {visible ? password : '••••••••••'}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        onClick={() => setVisible((v) => !v)}
        title={visible ? 'Скрыть' : 'Показать'}
      >
        {visible ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        onClick={copy}
        title="Копировать пароль"
      >
        <Copy className="size-3" />
      </Button>
    </div>
  );
}

export function ManagersTable({ managers }: ManagersTableProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleStatusChange = async (
    managerId: string,
    newStatus: 'active' | 'inactive' | 'blocked',
  ) => {
    setLoading(managerId);
    const res = await updateManagerStatusAction(managerId, newStatus);
    setLoading(null);
    if (!res.success) {
      toast.error(res.error ?? 'Ошибка обновления статуса');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
      case 'inactive':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'blocked':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Активен';
      case 'inactive':
        return 'Неактивен';
      case 'blocked':
        return 'Заблокирован';
      default:
        return status;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">ФИО</th>
            <th className="text-left px-4 py-2 font-medium">Email</th>
            <th className="text-left px-4 py-2 font-medium">Телефон</th>
            <th className="text-left px-4 py-2 font-medium">Пароль</th>
            <th className="text-center px-4 py-2 font-medium">Активных заявок</th>
            <th className="text-center px-4 py-2 font-medium">Распределено</th>
            <th className="text-center px-4 py-2 font-medium">Статус</th>
            <th className="text-right px-4 py-2 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {managers.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center py-8 text-muted-foreground">
                Менеджеры не найдены
              </td>
            </tr>
          ) : (
            managers.map((manager) => (
              <tr key={manager.id} className="border-t hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{manager.display_name}</td>
                <td className="px-4 py-2 text-sm">{manager.email}</td>
                <td className="px-4 py-2 text-sm font-mono">{manager.phone ?? '—'}</td>
                <td className="px-4 py-2">
                  <PasswordCell password={manager.temp_password} />
                </td>
                <td className="px-4 py-2 text-center font-bold">
                  <Badge variant="secondary">{manager.activeOrders ?? 0}</Badge>
                </td>
                <td className="px-4 py-2 text-center text-sm text-muted-foreground">
                  {manager.distribution_count ?? 0}
                </td>
                <td className="px-4 py-2 text-center">
                  <Badge className={getStatusColor(manager.status)}>
                    {getStatusLabel(manager.status)}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading === manager.id}
                        className="size-8 p-0"
                      >
                        {loading === manager.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="size-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {manager.status !== 'active' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(manager.id, 'active')}
                          disabled={loading === manager.id}
                        >
                          <Check className="mr-2 size-4" />
                          Активировать
                        </DropdownMenuItem>
                      )}
                      {manager.status !== 'inactive' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(manager.id, 'inactive')}
                          disabled={loading === manager.id}
                        >
                          Деактивировать
                        </DropdownMenuItem>
                      )}
                      {manager.status !== 'blocked' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(manager.id, 'blocked')}
                            disabled={loading === manager.id}
                            className="text-destructive"
                          >
                            Заблокировать
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
