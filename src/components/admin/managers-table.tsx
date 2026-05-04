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
import { MoreHorizontal, Loader2, Check } from 'lucide-react';

interface Manager {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone: string;
  status: string;
  distribution_count: number;
  created_at: string;
  activeOrders?: number;
}

interface ManagersTableProps {
  managers: Manager[];
}

export function ManagersTable({ managers }: ManagersTableProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleStatusChange = async (managerId: string, newStatus: 'active' | 'inactive' | 'blocked') => {
    setLoading(managerId);
    await updateManagerStatusAction(managerId, newStatus);
    setLoading(null);
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
            <th className="text-center px-4 py-2 font-medium">Активных заявок</th>
            <th className="text-center px-4 py-2 font-medium">Распределено</th>
            <th className="text-center px-4 py-2 font-medium">Статус</th>
            <th className="text-right px-4 py-2 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {managers.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-8 text-muted-foreground">
                Менеджеры не найдены
              </td>
            </tr>
          ) : (
            managers.map((manager) => (
              <tr key={manager.id} className="border-t hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{manager.display_name}</td>
                <td className="px-4 py-2 text-sm">{manager.email}</td>
                <td className="px-4 py-2 text-sm font-mono">{manager.phone}</td>
                <td className="px-4 py-2 text-center font-bold">
                  <Badge variant="secondary">{manager.activeOrders || 0}</Badge>
                </td>
                <td className="px-4 py-2 text-center text-sm text-muted-foreground">
                  {manager.distribution_count}
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
