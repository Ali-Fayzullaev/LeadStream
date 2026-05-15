'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  createOrderCommentAction,
  updateOrderCommentAction,
  deleteOrderCommentAction,
  type OrderCommentDTO,
} from '@/app/actions/order-comments';

interface Props {
  orderId: string;
  /**
   * Comments that were pre-fetched on the server. The component is
   * STATIC-FIRST: data is already in the HTML so admin / manager / broker
   * see the full thread immediately, even before JS hydrates. No client
   * round-trip is required to view the comments — only to mutate them.
   */
  initialComments: OrderCommentDTO[];
  /**
   * Whether the thread should start expanded. Defaults to `false` so list
   * pages with many rows stay compact, but it can be flipped to `true` for
   * detail pages.
   */
  defaultOpen?: boolean;
  /**
   * Compact mode: hide the form by default, show only the conversation.
   * The user clicks "Добавить" to reveal the textarea.
   * Defaults to `false`.
   */
  compactForm?: boolean;
}

const MAX_BODY = 2000;

const ROLE_META: Record<
  OrderCommentDTO['author_role'],
  { label: string; cls: string; dot: string; Icon: typeof User }
> = {
  admin:   { label: 'Админ',    cls: 'bg-violet-500/10 text-violet-700 border-violet-500/30',  dot: 'bg-violet-500', Icon: ShieldCheck },
  manager: { label: 'Менеджер', cls: 'bg-sky-500/10 text-sky-700 border-sky-500/30',           dot: 'bg-sky-500',    Icon: UserCog },
  broker:  { label: 'Брокер',   cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30', dot: 'bg-emerald-500', Icon: User },
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/**
 * Inline comments thread rendered directly inside an order row / card —
 * no modal, no extra fetch. Used on the admin / manager / broker list
 * pages so every role sees the full conversation at a glance.
 *
 * Server pre-fetches all comments via `getOrderCommentsBulk()` and passes
 * them as `initialComments`. CRUD still goes through server actions, but
 * because the page itself revalidates after a successful action, the
 * authoritative source of truth stays on the server — local state is
 * just an optimistic mirror so the UI feels instant.
 */
export function OrderCommentsInline({
  orderId,
  initialComments,
  defaultOpen = false,
  compactForm = false,
}: Props) {
  const [comments, setComments] = useState<OrderCommentDTO[]>(initialComments);
  const [open, setOpen] = useState<boolean>(defaultOpen || initialComments.length === 0);
  const [showForm, setShowForm] = useState<boolean>(!compactForm);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [pending, start] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep local state in sync if the server-rendered prop changes (e.g.
  // after Router.refresh() following a mutation in another row).
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const count = comments.length;
  const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    start(async () => {
      try {
        const res = await createOrderCommentAction(orderId, text);
        if (res && res.success) {
          setComments((prev) => [...prev, res.comment]);
          setDraft('');
        } else {
          toast.error((res && 'error' in res && res.error) || 'Не удалось добавить комментарий');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Сетевая ошибка');
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
      try {
        const res = await updateOrderCommentAction(id, text);
        if (res && res.success) {
          setComments((prev) => prev.map((x) => (x.id === id ? res.comment : x)));
          setEditingId(null);
        } else {
          toast.error((res && 'error' in res && res.error) || 'Не удалось сохранить');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Сетевая ошибка');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Удалить комментарий?')) return;
    start(async () => {
      try {
        const res = await deleteOrderCommentAction(id);
        if (res && res.success) {
          setComments((prev) => prev.filter((x) => x.id !== id));
        } else {
          toast.error((res && 'error' in res && res.error) || 'Не удалось удалить');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Сетевая ошибка');
      }
    });
  };

  // ── Empty state — invite the user to add the first message ─────────────
  if (count === 0 && !open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setShowForm(true);
          setTimeout(() => textareaRef.current?.focus(), 50);
        }}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/60"
      >
        <MessageSquare className="size-3.5" />
        <span>Добавить комментарий</span>
      </button>
    );
  }

  return (
    <div className="w-full max-w-md">
      {/* ── Header (clickable toggle) ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`w-full flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors ${
          count > 0 ? 'bg-sky-500/5 hover:bg-sky-500/10' : 'hover:bg-muted/60'
        }`}
      >
        <MessageSquare
          className={`size-4 shrink-0 ${count > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'}`}
        />
        <span className="text-xs font-medium">
          Комментарии
          {count > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold">
              {count}
            </span>
          )}
        </span>
        {/* Inline preview of the latest message when collapsed */}
        {!open && lastComment && (
          <span className="ml-auto flex items-center gap-1.5 min-w-0 max-w-[200px]">
            <span
              aria-hidden="true"
              className={`inline-block size-1.5 rounded-full shrink-0 ${ROLE_META[lastComment.author_role].dot}`}
            />
            <span className="text-[11px] text-muted-foreground truncate">
              {lastComment.body}
            </span>
          </span>
        )}
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''} ${!open && lastComment ? '' : 'ml-auto'}`}
        />
      </button>

      {/* ── Expanded thread ──────────────────────────────────────── */}
      {open && (
        <div className="mt-2 space-y-2">
          {/* List */}
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-1 py-2">
              Пока нет комментариев. Будьте первым!
            </p>
          ) : (
            <ul className="space-y-1.5">
              {comments.map((c) => {
                const meta = ROLE_META[c.author_role];
                const isEditing = editingId === c.id;
                return (
                  <li
                    key={c.id}
                    className={`rounded-md border p-2 text-sm ${
                      c.is_mine ? 'bg-accent/40' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border ${meta.cls}`}
                      >
                        <meta.Icon className="size-2.5" />
                        {meta.label}
                      </span>
                      {c.author_name && (
                        <span className="text-[11px] font-medium text-foreground truncate max-w-[140px]">
                          {c.author_name}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDate(c.created_at)}
                        {c.edited && <span className="italic"> · изм.</span>}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-1.5">
                        <Textarea
                          value={editingDraft}
                          onChange={(e) =>
                            setEditingDraft(e.target.value.slice(0, MAX_BODY))
                          }
                          rows={2}
                          className="resize-none text-xs min-h-0"
                          autoFocus
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSaveEdit(c.id)}
                            disabled={pending || !editingDraft.trim()}
                            className="h-6 px-2 text-[11px] gap-1"
                          >
                            {pending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                            Сохранить
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            disabled={pending}
                            className="h-6 px-2 text-[11px] gap-1"
                          >
                            <X className="size-3" />
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs whitespace-pre-wrap break-words leading-relaxed">
                          {c.body}
                        </p>
                        {c.is_mine && (
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(c)}
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted"
                            >
                              <Pencil className="size-2.5" />
                              Изменить
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              disabled={pending}
                              className="inline-flex items-center gap-1 text-[10px] text-destructive/80 hover:text-destructive px-1 py-0.5 rounded hover:bg-destructive/10"
                            >
                              <Trash2 className="size-2.5" />
                              Удалить
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* New comment form */}
          {showForm ? (
            <form onSubmit={handleCreate} className="space-y-1.5">
              <Textarea
                ref={textareaRef}
                placeholder="Напишите комментарий…"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
                rows={2}
                className="resize-none text-xs min-h-0"
                disabled={pending}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    handleCreate(e);
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {draft.length}/{MAX_BODY} · Ctrl+Enter
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={pending || !draft.trim()}
                  className="h-7 px-3 text-xs gap-1.5"
                >
                  {pending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Send className="size-3" />
                  )}
                  Отправить
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
            >
              <MessageSquare className="size-3" />
              Добавить комментарий
            </button>
          )}
        </div>
      )}
    </div>
  );
}
