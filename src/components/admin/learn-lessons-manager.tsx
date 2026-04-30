'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Loader2,
  Pencil,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Youtube,
  GripVertical,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  learnLessonSchema,
  type LearnLessonInput,
} from '@/lib/validations';
import {
  adminCreateLearnLessonAction,
  adminUpdateLearnLessonAction,
  adminDeleteLearnLessonAction,
} from '@/app/admin/actions';
import { getYoutubeId, getYoutubeThumbnail } from '@/lib/youtube';

export interface LessonRow {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  body: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

export function LearnLessonsManager({ initial }: { initial: LessonRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<LessonRow[]>(initial);
  const [editing, setEditing] = useState<LessonRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const handleDelete = () => {
    if (!deleteId) return;
    start(async () => {
      const res = await adminDeleteLearnLessonAction(deleteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      toast.success('Урок удалён');
      setDeleteId(null);
      router.refresh();
    });
  };

  const togglePublished = (row: LessonRow) => {
    start(async () => {
      const res = await adminUpdateLearnLessonAction(row.id, {
        is_published: !row.is_published,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, is_published: !r.is_published } : r)),
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Всего: <span className="font-medium text-foreground">{rows.length}</span>
        </p>
        <Button onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="size-4" />
          Добавить урок
        </Button>
      </div>

      {creating && (
        <LessonForm
          onCancel={() => setCreating(false)}
          onSaved={(row) => {
            setRows((prev) => [row, ...prev]);
            setCreating(false);
            router.refresh();
          }}
        />
      )}

      {rows.length === 0 && !creating ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Пока нет уроков. Нажмите «Добавить урок», чтобы создать первый.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) =>
            editing?.id === row.id ? (
              <LessonForm
                key={row.id}
                initial={row}
                onCancel={() => setEditing(null)}
                onSaved={(updated) => {
                  setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                  setEditing(null);
                  router.refresh();
                }}
              />
            ) : (
              <LessonCardView
                key={row.id}
                row={row}
                pending={pending}
                onEdit={() => setEditing(row)}
                onDelete={() => setDeleteId(row.id)}
                onTogglePublished={() => togglePublished(row)}
              />
            ),
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Удалить урок?"
        description="Действие нельзя отменить. Урок исчезнет у стримеров."
        confirmLabel="Удалить"
        variant="destructive"
        pending={pending}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}

function LessonCardView({
  row,
  pending,
  onEdit,
  onDelete,
  onTogglePublished,
}: {
  row: LessonRow;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublished: () => void;
}) {
  const thumb = getYoutubeThumbnail(row.youtube_url);
  const ytId = getYoutubeId(row.youtube_url);
  return (
    <Card>
      <CardContent className="p-4 flex gap-4">
        <GripVertical className="size-4 text-muted-foreground/40 shrink-0 mt-2 hidden sm:block" />
        <div className="relative shrink-0 w-32 sm:w-44 aspect-video rounded-md overflow-hidden bg-muted ring-1 ring-border">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full flex items-center justify-center text-muted-foreground">
              <Youtube className="size-6" />
            </div>
          )}
          {ytId && (
            <span className="absolute bottom-1 right-1 rounded bg-black/70 text-white text-[10px] px-1.5 py-0.5">
              YouTube
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start gap-2">
            <h3 className="font-semibold truncate flex-1">{row.title}</h3>
            <span
              className={
                'shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ' +
                (row.is_published
                  ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30'
                  : 'bg-muted text-muted-foreground ring-border')
              }
            >
              {row.is_published ? 'Опубликован' : 'Скрыт'}
            </span>
          </div>
          {row.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{row.description}</p>
          )}
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span>Порядок: {row.sort_order}</span>
            {row.youtube_url && (
              <a
                href={row.youtube_url}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline truncate max-w-[200px]"
              >
                {row.youtube_url}
              </a>
            )}
          </div>
          <div className="flex items-center gap-1 pt-2">
            <Button size="sm" variant="ghost" onClick={onEdit} disabled={pending}>
              <Pencil className="size-3.5" />
              Изменить
            </Button>
            <Button size="sm" variant="ghost" onClick={onTogglePublished} disabled={pending}>
              {row.is_published ? (
                <>
                  <EyeOff className="size-3.5" />
                  Скрыть
                </>
              ) : (
                <>
                  <Eye className="size-3.5" />
                  Опубликовать
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              disabled={pending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Удалить
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LessonForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: LessonRow;
  onCancel: () => void;
  onSaved: (row: LessonRow) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial;

  const form = useForm<LearnLessonInput>({
    resolver: zodResolver(learnLessonSchema),
    defaultValues: {
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      youtube_url: initial?.youtube_url ?? '',
      body: initial?.body ?? '',
      sort_order: initial?.sort_order ?? 0,
      is_published: initial?.is_published ?? true,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const payload: LearnLessonInput = {
        ...values,
        description: values.description || null,
        youtube_url: values.youtube_url || null,
        body: values.body || null,
      };
      if (isEdit && initial) {
        const res = await adminUpdateLearnLessonAction(initial.id, payload);
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success('Сохранено');
        onSaved({ ...initial, ...payload });
      } else {
        const res = await adminCreateLearnLessonAction(payload);
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        toast.success('Урок создан');
        onSaved({
          id: res.data!.id,
          title: payload.title,
          description: payload.description ?? null,
          youtube_url: payload.youtube_url ?? null,
          body: payload.body ?? null,
          sort_order: payload.sort_order,
          is_published: payload.is_published,
          created_at: new Date().toISOString(),
        });
      }
    });
  });

  return (
    <Card className="ring-2 ring-primary/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{isEdit ? 'Редактировать урок' : 'Новый урок'}</h3>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Отмена
          </Button>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1">
            <Label>Название</Label>
            <Input {...form.register('title')} placeholder="Например: Как закрыть возражение «дорого»" />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="sm:col-span-2 space-y-1">
            <Label>Ссылка на YouTube</Label>
            <Input
              {...form.register('youtube_url')}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            {form.formState.errors.youtube_url && (
              <p className="text-xs text-destructive">{form.formState.errors.youtube_url.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Поддерживаются ссылки watch?v=, youtu.be/, /embed/, /shorts/.
            </p>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <Label>Краткое описание</Label>
            <Textarea
              rows={2}
              {...form.register('description')}
              placeholder="Что узнает стример, посмотрев это видео"
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="sm:col-span-2 space-y-1">
            <Label>Дополнительный текст (опционально)</Label>
            <Textarea
              rows={4}
              {...form.register('body')}
              placeholder="Конспект, чек-лист, ссылки и т.д."
            />
          </div>

          <div className="space-y-1">
            <Label>Порядок сортировки</Label>
            <Input
              type="number"
              min={0}
              max={9999}
              {...form.register('sort_order', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                {...form.register('is_published')}
              />
              Опубликован
            </Label>
            <p className="text-xs text-muted-foreground">Если выключено — стримеры не увидят урок.</p>
          </div>

          {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
