'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Check, Lock, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/status-badge';
import {
  adminCreateStatusAction,
  adminUpdateStatusAction,
  adminDeleteStatusAction,
} from '@/app/admin/actions';

interface Status {
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_system: boolean;
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#64748b', // slate
];

export function StatusesSection({ statuses }: { statuses: Status[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="divide-y">
      {statuses.map((s) => (
        <StatusRow key={s.key} status={s} allStatuses={statuses} />
      ))}

      <div className="p-4 bg-muted/20">
        {adding ? (
          <NewStatusForm onCancel={() => setAdding(false)} onDone={() => setAdding(false)} />
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Добавить статус
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusRow({ status, allStatuses }: { status: Status; allStatuses: Status[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState({
    label: status.label,
    color: status.color,
    sort_order: status.sort_order,
  });

  const save = () => {
    start(async () => {
      const res = await adminUpdateStatusAction(status.key, draft);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Статус сохранён');
      setEditing(false);
      router.refresh();
    });
  };

  const otherStatuses = allStatuses.filter((s) => s.key !== status.key);

  if (editing) {
    return (
      <div className="p-4 space-y-3 bg-muted/20">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Название</Label>
            <Input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Цвет</Label>
            <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Порядок</Label>
            <Input
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Превью:</span>
          <StatusBadge label={draft.label || '—'} color={draft.color} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Сохранить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(status); }} disabled={pending}>
            <X className="size-4" />
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 flex items-center gap-4">
        <StatusBadge label={status.label} color={status.color} />
        <div className="flex-1 min-w-0">
          <code className="text-xs text-muted-foreground font-mono">{status.key}</code>
          {status.is_system && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" /> системный
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">
          порядок: {status.sort_order}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Редактировать">
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDeleteDialog(true)}
            disabled={pending}
            aria-label="Удалить"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
          </Button>
        </div>
      </div>

      {deleteDialog && (
        <DeleteStatusDialog
          status={status}
          otherStatuses={otherStatuses}
          onClose={() => setDeleteDialog(false)}
          onDone={() => {
            setDeleteDialog(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function DeleteStatusDialog({
  status,
  otherStatuses,
  onClose,
  onDone,
}: {
  status: Status;
  otherStatuses: Status[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [replaceWith, setReplaceWith] = useState(otherStatuses[0]?.key ?? '');

  const confirm = () => {
    start(async () => {
      const res = await adminDeleteStatusAction(status.key, { replaceWith });
      if (!res.ok) {
        // If still failing — maybe no orders exist; retry without replaceWith.
        const retry = await adminDeleteStatusAction(status.key);
        if (!retry.ok) {
          toast.error(retry.error);
          return;
        }
      }
      toast.success('Статус удалён');
      onDone();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Удалить статус?</h3>
              <p className="text-sm text-muted-foreground">
                Статус <StatusBadge label={status.label} color={status.color} /> будет удалён.
                {status.is_system && ' Это системный статус — будьте внимательны.'}
              </p>
            </div>
          </div>

          {otherStatuses.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">
                Если есть заказы с этим статусом — переназначить их на:
              </Label>
              <select
                value={replaceWith}
                onChange={(e) => setReplaceWith(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {otherStatuses.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} ({s.key})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Если заказов с этим статусом нет — ничего не изменится.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Удалить
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewStatusForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState({
    key: '',
    label: '',
    color: PRESET_COLORS[0],
    sort_order: 100,
  });

  const create = () => {
    start(async () => {
      const res = await adminCreateStatusAction(draft);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Статус создан');
      router.refresh();
      onDone();
    });
  };

  return (
    <div className="space-y-3 rounded-md border bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Ключ (латиница)</Label>
          <Input
            placeholder="processing"
            value={draft.key}
            onChange={(e) => setDraft({ ...draft, key: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Внутреннее имя — изменить нельзя</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Название</Label>
          <Input
            placeholder="В обработке"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Цвет</Label>
          <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Порядок</Label>
          <Input
            type="number"
            value={draft.sort_order}
            onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Превью:</span>
        <StatusBadge label={draft.label || '—'} color={draft.color} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={create} disabled={pending || !draft.key || !draft.label}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Создать
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          <X className="size-4" />
          Отмена
        </Button>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 rounded-md border cursor-pointer p-0.5 bg-background"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
      <div className="flex gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`size-5 rounded-full border-2 transition-transform hover:scale-110 ${
              value.toLowerCase() === c ? 'border-foreground scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}
