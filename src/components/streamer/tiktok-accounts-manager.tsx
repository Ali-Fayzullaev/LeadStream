'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, ExternalLink, Music2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addTikTokAccountAction,
  deleteTikTokAccountAction,
} from '@/app/streamer/actions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface TikTokAccount {
  id: string;
  username: string;
  is_primary: boolean;
}

export function TikTokAccountsManager({
  accounts,
  max = 10,
}: {
  accounts: TikTokAccount[];
  max?: number;
}) {
  const [draft, setDraft] = useState('');
  const [pending, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const value = draft.trim().replace(/^@/, '');
    if (!value) return;
    if (accounts.length >= max) {
      toast.error(`Максимум ${max} аккаунтов`);
      return;
    }
    start(async () => {
      const res = await addTikTokAccountAction(value);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Аккаунт добавлен');
      setDraft('');
    });
  };

  const onDelete = (id: string) => {
    start(async () => {
      const res = await deleteTikTokAccountAction(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Аккаунт удалён');
      setConfirmId(null);
    });
  };

  const confirmAccount = accounts.find((a) => a.id === confirmId);

  return (
    <div className="space-y-4">
      {accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <Music2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Пока нет привязанных TikTok-аккаунтов.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="group flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white">
                  <img src="https://static.vecteezy.com/system/resources/thumbnails/016/716/450/small_2x/tiktok-icon-free-png.png" alt="TikTok" />
                </div>
                <div className="min-w-0">
                  <a
                    href={`https://www.tiktok.com/@${a.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:underline truncate"
                  >
                    @{a.username}
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </a>
                  {a.is_primary && (
                    <span className="ml-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                      основной
                    </span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Удалить"
                disabled={pending}
                onClick={() => setConfirmId(a.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {accounts.length < max && (
        <form onSubmit={onAdd} className="space-y-2">
          <Label htmlFor="new_tiktok">Добавить TikTok аккаунт</Label>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center rounded-md border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
              <span className="px-3 text-sm text-muted-foreground select-none">@</span>
              <Input
                id="new_tiktok"
                placeholder="alex_streams"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="off"
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <Button type="submit" disabled={pending || !draft.trim()} className="gap-2">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Добавить
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Введите имя пользователя TikTok без <code>@</code>. Например, у{' '}
            <a
              href="https://www.tiktok.com/@tiktok"
              target="_blank"
              rel="noreferrer"
              className="text-fuchsia-600 hover:underline dark:text-fuchsia-400"
            >
              tiktok.com/@tiktok
            </a>{' '}
            это будет <code>tiktok</code>.
          </p>
        </form>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Удалить TikTok аккаунт?"
        description={
          confirmAccount ? (
            <>
              Аккаунт <b>@{confirmAccount.username}</b> будет отвязан от вашего профиля.
            </>
          ) : null
        }
        confirmLabel="Удалить"
        variant="destructive"
        pending={pending}
        onConfirm={() => confirmId && onDelete(confirmId)}
      />
    </div>
  );
}
