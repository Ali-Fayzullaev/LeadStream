'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  MessageSquare,
  Send,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check,
  ShieldCheck,
  UserCog,
  User,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  listOrderCommentsAction,
  createOrderCommentAction,
  updateOrderCommentAction,
  deleteOrderCommentAction,
  type OrderCommentDTO,
} from '@/app/actions/order-comments';

interface Props {
  orderId: string;
  /** Optional initial count shown on the trigger button (server-rendered). */
  initialCount?: number;
  /** Compact icon-only trigger? Defaults to false → shows count. */
  iconOnly?: boolean;
}

const MAX_BODY = 2000;

const ROLE_META: Record<OrderCommentDTO['author_role'], { label: string; cls: string; Icon: typeof User }> = {
  admin:   { label: 'Админ',    cls: 'bg-violet-500/10 text-violet-700 border-violet-500/30',  Icon: ShieldCheck },
  manager: { label: 'Менеджер', cls: 'bg-sky-500/10 text-sky-700 border-sky-500/30',           Icon: UserCog },
  broker:  { label: 'Брокер',   cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30', Icon: User },
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
}

export function OrderCommentsThread({ orderId, initialCount = 0, iconOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<OrderCommentDTO[]>([]);
  const [count, setCount] = useState<number>(initialCount);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [pending, start] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load comments when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listOrderCommentsAction(orderId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setComments(res.comments);
          setCount(res.comments.length);
        } else {
          toast.error(res.error);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [open, orderId]);

  // Scroll to bottom when comments change
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length, open]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    start(async () => {
      const res = await createOrderCommentAction(orderId, text);
      if (res.success) {
        setComments((prev) => [...prev, res.comment]);
        setCount((c) => c + 1);
        setDraft('');
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleStartEdit = (c: OrderCommentDTO) => {
    setEditingId(c.id);
    setEditingDraft(c.body);
  };

  const handleSaveEdit = (id: string) => {
    const text = editingDraft.trim();
    if (!text) return;
    start(async () => {
      const res = await updateOrderCommentAction(id, text);
      if (res.success) {
        setComments((prev) => prev.map((x) => (x.id === id ? res.comment : x)));
        setEditingId(null);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Удалить комментарий?')) return;
    start(async () => {
      const res = await deleteOrderCommentAction(id);
      if (res.success) {
        setComments((prev) => prev.filter((x) => x.id !== id));
        setCount((c) => Math.max(0, c - 1));
      } else {
        toast.error(res.error);
      }
    });
  };

  const hasComments = count > 0;
  const ariaLabel = hasComments
    ? `Комментарии (${count})`
    : 'Добавить комментарий';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={ariaLabel}
          title={ariaLabel}
          className={`relative gap-1.5 h-8 ${iconOnly ? 'px-2' : 'px-2.5'} transition-colors ${
            hasComments
              ? 'text-sky-700 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className={`size-4 ${hasComments ? 'fill-sky-500/20' : ''}`} />
          {!iconOnly && (
            hasComments ? (
              <span className="font-medium text-xs">{count}</span>
            ) : (
              <span className="text-xs">Комментарий</span>
            )
          )}
          {/* Notification badge — visible in icon-only mode */}
          {iconOnly && hasComments && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold leading-4 text-center shadow-sm ring-2 ring-background"
              aria-hidden="true"
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            Комментарии к лиду
            {count > 0 && <Badge variant="secondary" className="ml-1">{count}</Badge>}
          </DialogTitle>
          <DialogDescription>
            Видны admin / менеджеру / брокеру, у которых есть доступ к этому заказу.
          </DialogDescription>
        </DialogHeader>

        {/* Thread */}
        <div
          ref={scrollRef}
          className="max-h-[50vh] overflow-y-auto space-y-3 pr-1 -mx-1 px-1"
        >
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" />
              Загрузка…
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Пока нет комментариев. Будьте первым!
            </p>
          ) : (
            comments.map((c) => {
              const meta = ROLE_META[c.author_role];
              const isEditing = editingId === c.id;
              return (
                <div key={c.id} className={`rounded-lg border p-3 ${c.is_mine ? 'bg-accent/40' : 'bg-card'}`}>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium border ${meta.cls}`}>
                      <meta.Icon className="size-3" />
                      {meta.label}
                    </span>
                    {c.author_name && (
                      <span className="text-xs font-medium text-foreground">{c.author_name}</span>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {formatDate(c.created_at)}
                      {c.edited && <span className="italic"> · изменено</span>}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingDraft}
                        onChange={(e) => setEditingDraft(e.target.value.slice(0, MAX_BODY))}
                        rows={3}
                        className="resize-none text-sm"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(c.id)}
                          disabled={pending || !editingDraft.trim()}
                          className="h-7 gap-1"
                        >
                          {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                          Сохранить
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={pending}
                          className="h-7 gap-1"
                        >
                          <X className="size-3" />
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{c.body}</p>
                      {c.is_mine && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(c)}
                            className="h-6 px-1.5 text-xs gap-1"
                          >
                            <Pencil className="size-3" />
                            Изменить
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(c.id)}
                            disabled={pending}
                            className="h-6 px-1.5 text-xs gap-1 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-3" />
                            Удалить
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* New comment form */}
        <form onSubmit={handleCreate} className="space-y-2 pt-2 border-t">
          <Textarea
            placeholder="Напишите комментарий…"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
            rows={3}
            className="resize-none text-sm"
            disabled={pending}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                handleCreate(e);
              }
            }}
          />
          <DialogFooter className="flex-row items-center !justify-between gap-2 sm:!justify-between">
            <span className="text-xs text-muted-foreground">
              {draft.length}/{MAX_BODY} · Ctrl+Enter
            </span>
            <Button type="submit" disabled={pending || !draft.trim()} className="gap-2">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Отправить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
