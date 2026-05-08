'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2, PackageSearch, ChevronDown, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/user-avatar';
import { adminUpdateOrderStatusAction, adminDeleteOrderAction, adminUpdateOrderCityAction } from '@/app/admin/actions';
import { formatCurrency } from '@/lib/utils';
import { OrderCommentsThread } from '@/components/order-comments-thread';

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
  city_id: string | null;
  city_name: string | null;
  is_assigned: boolean;
  comments_count?: number;
}

export interface City {
  id: string;
  name: string;
}

export interface StatusOption {
  key: string;
  label: string;
  color: string;
}

export function OrdersTable({ rows, statuses, cities }: { rows: OrderRow[]; statuses: StatusOption[]; cities: City[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Дата</th>
            <th className="text-left px-4 py-2 font-medium">Клиент</th>
            <th className="text-left px-4 py-2 font-medium">Телефон</th>
            <th className="text-left px-4 py-2 font-medium">Стример</th>
            <th className="text-left px-4 py-2 font-medium">Город</th>
            <th className="text-left px-4 py-2 font-medium">Статус</th>
            <th className="text-right px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <OrderRowView key={r.id} row={r} statuses={statuses} cities={cities} />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title="Заказов пока нет"
          description="Когда появятся новые заказы — они отобразятся здесь. Попробуйте сбросить фильтры."
        />
      )}
    </div>
  );
}

function OrderRowView({ row, statuses, cities }: { row: OrderRow; statuses: StatusOption[]; cities: City[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string>(row.status);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cityId, setCityId] = useState<string>(row.city_id ?? '');

  const changeCity = (newCityId: string) => {
    const selected = newCityId ? newCityId : null;
    setCityId(newCityId);
    start(async () => {
      const res = await adminUpdateOrderCityAction(row.id, selected);
      if (!res.ok) {
        setCityId(row.city_id ?? '');
        toast.error(res.error);
        return;
      }
      toast.success('Город обновлён, менеджер назначен');
      router.refresh();
    });
  };

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
    start(async () => {
      const res = await adminDeleteOrderAction(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Заказ удалён');
      setConfirmOpen(false);
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
        <CitySelect
          value={cityId}
          cities={cities}
          onChange={changeCity}
          pending={pending}
          isUndefined={!row.city_id}
        />
      </td>
      <td className="px-4 py-2">
        <StatusSelect
          value={status}
          statuses={statuses}
          onChange={change}
          pending={pending}
          current={current}
        />
      </td>
      <td className="px-4 py-2 text-right">
        <div className="inline-flex items-center gap-1">
          <OrderCommentsThread orderId={row.id} iconOnly initialCount={row.comments_count ?? 0} />
          <Button size="icon" variant="ghost" onClick={() => setConfirmOpen(true)} disabled={pending} aria-label="Delete order">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
          </Button>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Удалить заказ?"
          description={
            <>
              Заказ <b className="text-foreground">{row.customer_name}</b> на сумму{' '}
              <b className="text-foreground">{formatCurrency(Number(row.amount))}</b> будет удалён без возможности восстановления.
            </>
          }
          confirmLabel="Удалить"
          variant="destructive"
          pending={pending}
          onConfirm={remove}
          onClose={() => setConfirmOpen(false)}
        />
      </td>
    </tr>
  );
}

/**
 * City selector: shows city name if assigned, or orange "Undefined" badge if not.
 * Clicking opens a dropdown to select a city.
 */
function CitySelect({
  value,
  cities,
  onChange,
  pending,
  isUndefined,
}: {
  value: string;
  cities: City[];
  onChange: (cityId: string) => void;
  pending: boolean;
  isUndefined: boolean;
}) {
  const selectedCity = cities.find((c) => c.id === value);
  const label = selectedCity?.name ?? (isUndefined ? 'Неопределённая' : '—');
  const isOrange = isUndefined;

  return (
    <div
      className={`relative inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium cursor-pointer transition-opacity ${
        isOrange
          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
          : 'border border-muted'
      }`}
      style={{
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <MapPin className="size-3 opacity-60" />
      )}
      <span className="pointer-events-none">{label}</span>
      <ChevronDown className="size-3 pointer-events-none opacity-60" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">— Выбрать город —</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Single, inline-editable status pill: combines the colored badge with a native
 * <select> overlay. Visually identical to a StatusBadge but acts as a dropdown.
 * Only rendered inside the admin table, so editability is admin-only by design.
 */
function StatusSelect({
  value,
  statuses,
  onChange,
  pending,
  current,
}: {
  value: string;
  statuses: StatusOption[];
  onChange: (next: string) => void;
  pending: boolean;
  current?: StatusOption;
}) {
  const color = current?.color ?? '#64748b';
  const label = current?.label ?? value;
  return (
    <div
      className="relative inline-flex items-center gap-1 rounded-full border font-medium px-2.5 py-1 text-xs transition-opacity"
      style={{
        color,
        backgroundColor: `${color}1a`,
        borderColor: `${color}4d`,
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : null}
      <span className="pointer-events-none">{label}</span>
      <ChevronDown className="size-3 pointer-events-none opacity-70" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        aria-label="Сменить статус"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {statuses.map((s) => (
          <option key={s.key} value={s.key} style={{ color: 'inherit' }}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
