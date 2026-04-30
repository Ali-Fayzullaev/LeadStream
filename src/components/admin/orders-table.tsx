'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { StatusBadge } from '@/components/status-badge';
import { adminUpdateOrderStatusAction, adminDeleteOrderAction } from '@/app/admin/actions';
import { formatCurrency } from '@/lib/utils';

export interface OrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  quantity: number;
  amount: number;
  status: string;
  streamer_name: string | null;
  streamer_avatar: string | null;
  ref_code_snapshot: string | null;
  created_at: string;
}

export interface StatusOption {
  key: string;
  label: string;
  color: string;
}

export function OrdersTable({ rows, statuses }: { rows: OrderRow[]; statuses: StatusOption[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Дата</th>
            <th className="text-left px-4 py-2 font-medium">Клиент</th>
            <th className="text-left px-4 py-2 font-medium">Телефон</th>
            <th className="text-left px-4 py-2 font-medium">Товар</th>
            <th className="text-right px-4 py-2 font-medium">Кол-во</th>
            <th className="text-right px-4 py-2 font-medium">Сумма</th>
            <th className="text-left px-4 py-2 font-medium">Стример</th>
            <th className="text-left px-4 py-2 font-medium">Статус</th>
            <th className="text-right px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <OrderRowView key={r.id} row={r} statuses={statuses} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-6 py-8 text-sm text-muted-foreground text-center">Заказов нет.</p>
      )}
    </div>
  );
}

function OrderRowView({ row, statuses }: { row: OrderRow; statuses: StatusOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string>(row.status);

  const change = (next: string) => {
    setStatus(next);
    start(async () => {
      const res = await adminUpdateOrderStatusAction(row.id, next);
      if (!res.ok) {
        setStatus(row.status);
        toast.error(res.error);
        return;
      }
      toast.success('Статус обновлён');
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirm('Удалить этот заказ? Действие нельзя отменить.')) return;
    start(async () => {
      const res = await adminDeleteOrderAction(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Заказ удалён');
      router.refresh();
    });
  };

  const current = statuses.find((s) => s.key === status);

  return (
    <tr className="border-t">
      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
        {new Date(row.created_at).toLocaleString()}
      </td>
      <td className="px-4 py-2">{row.customer_name}</td>
      <td className="px-4 py-2 font-mono text-xs">{row.customer_phone}</td>
      <td className="px-4 py-2">{row.product_name}</td>
      <td className="px-4 py-2 text-right">{row.quantity}</td>
      <td className="px-4 py-2 text-right">{formatCurrency(Number(row.amount))}</td>
      <td className="px-4 py-2">
        {row.streamer_name ? (
          <div className="flex items-center gap-2">
            <UserAvatar name={row.streamer_name} avatarUrl={row.streamer_avatar} size={24} />
            <span>
              {row.streamer_name}
              {row.ref_code_snapshot && (
                <span className="text-xs text-muted-foreground font-mono"> · {row.ref_code_snapshot}</span>
              )}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground italic">прямой заход</span>
        )}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {current ? (
            <StatusBadge label={current.label} color={current.color} />
          ) : (
            <span className="text-xs text-muted-foreground">{status}</span>
          )}
          <select
            value={status}
            onChange={(e) => change(e.target.value)}
            disabled={pending}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Сменить статус"
          >
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        <Button size="icon" variant="ghost" onClick={remove} disabled={pending} aria-label="Delete order">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
        </Button>
      </td>
    </tr>
  );
}
