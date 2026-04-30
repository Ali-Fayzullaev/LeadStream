'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, Loader2, Pencil, Users, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/user-avatar';
import { adminUpdateStreamerAction } from '@/app/admin/actions';
import { formatCurrency } from '@/lib/utils';

export interface StreamerRow {
  id: string;
  display_name: string;
  ref_code: string;
  status: 'pending' | 'active' | 'blocked';
  commission_percent: number;
  orders_count: number;
  revenue: number;
  commission: number;
  email: string | null;
  created_at: string;
  avatar_url: string | null;
}

export function StreamersTable({ rows, appUrl }: { rows: StreamerRow[]; appUrl: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Стример</th>
            <th className="text-left px-4 py-2 font-medium">Email</th>
            <th className="text-left px-4 py-2 font-medium">Реф-код</th>
            <th className="text-left px-4 py-2 font-medium">Уникальная ссылка</th>
            <th className="text-right px-4 py-2 font-medium">Комм. %</th>
            <th className="text-left px-4 py-2 font-medium">Статус</th>
            <th className="text-right px-4 py-2 font-medium">Заказы</th>
            <th className="text-right px-4 py-2 font-medium">Выручка</th>
            <th className="text-right px-4 py-2 font-medium">Комиссия</th>
            <th className="text-right px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <StreamerRowView key={r.id} row={r} appUrl={appUrl} />)}
        </tbody>
      </table>
      {rows.length === 0 && (
        <EmptyState
          icon={Users}
          title="Стримеров пока нет"
          description="Новые стримеры появятся здесь после регистрации и одобрения."
        />
      )}
    </div>
  );
}

function StreamerRowView({ row, appUrl }: { row: StreamerRow; appUrl: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState({
    ref_code: row.ref_code,
    commission_percent: row.commission_percent,
    status: row.status,
  });

  const update = (patch: Partial<typeof draft>) => {
    start(async () => {
      const res = await adminUpdateStreamerAction(row.id, patch);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Сохранено');
      setEditing(false);
      router.refresh();
    });
  };

  const statusBadge: Record<StreamerRow['status'], string> = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    blocked: 'bg-red-500/10 text-red-500 border-red-500/30',
  };

  return (
    <tr className="border-t">
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <UserAvatar name={row.display_name} avatarUrl={row.avatar_url} size={28} />
          <span className="font-medium">{row.display_name}</span>
        </div>
      </td>
      <td className="px-4 py-2 text-muted-foreground">{row.email ?? '—'}</td>
      <td className="px-4 py-2 font-mono text-xs">
        {editing ? (
          <Input
            value={draft.ref_code}
            onChange={(e) => setDraft({ ...draft, ref_code: e.target.value })}
            className="h-8 w-32 font-mono text-xs"
          />
        ) : row.ref_code}
      </td>
      <td className="px-4 py-2">
        <CopyLinkCell url={`${appUrl}/?ref=${row.ref_code}`} />
      </td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={draft.commission_percent}
            onChange={(e) => setDraft({ ...draft, commission_percent: Number(e.target.value) })}
            className="h-8 w-20 text-right"
          />
        ) : `${row.commission_percent}%`}
      </td>
      <td className="px-4 py-2">
        {editing ? (
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as StreamerRow['status'] })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="pending">pending</option>
            <option value="active">active</option>
            <option value="blocked">blocked</option>
          </select>
        ) : (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusBadge[row.status]}`}>
            {row.status}
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-right">{row.orders_count}</td>
      <td className="px-4 py-2 text-right">{formatCurrency(Number(row.revenue))}</td>
      <td className="px-4 py-2 text-right">{formatCurrency(Number(row.commission))}</td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" onClick={() => update(draft)} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-primary" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => { setDraft({ ref_code: row.ref_code, commission_percent: row.commission_percent, status: row.status }); setEditing(false); }} disabled={pending}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-1">
            {row.status === 'pending' && (
              <Button size="sm" variant="outline" onClick={() => update({ status: 'active' })} disabled={pending}>
                Одобрить
              </Button>
            )}
            {row.status === 'active' && (
              <Button size="sm" variant="ghost" onClick={() => update({ status: 'blocked' })} disabled={pending}>
                Заблокировать
              </Button>
            )}
            {row.status === 'blocked' && (
              <Button size="sm" variant="outline" onClick={() => update({ status: 'active' })} disabled={pending}>
                Разблокировать
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function CopyLinkCell({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-xs text-muted-foreground truncate max-w-[180px]" title={url}>
        {url}
      </span>
      <button
        onClick={copy}
        title="Копировать ссылку"
        className="shrink-0 rounded p-1 hover:bg-muted transition-colors"
      >
        {copied
          ? <Check className="size-3.5 text-emerald-500" />
          : <Copy className="size-3.5 text-muted-foreground" />}
      </button>
    </div>
  );
}
