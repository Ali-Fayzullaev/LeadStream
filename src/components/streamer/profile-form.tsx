'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Loader2,
  Bell,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateStreamerProfileSchema, type UpdateStreamerProfileInput } from '@/lib/validations';
import {
  updateStreamerProfileAction,
  sendTestTelegramToStreamerAction,
} from '@/app/streamer/actions';

const BOT_USERNAME = 'lead300426_bot';

interface ProfileFormProps {
  initial: UpdateStreamerProfileInput;
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [pending, start] = useTransition();
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UpdateStreamerProfileInput>({
    resolver: zodResolver(updateStreamerProfileSchema),
    defaultValues: initial,
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await updateStreamerProfileAction(values);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Профиль сохранён');
    });
  });

  const handleTest = async () => {
    setTesting(true);
    const res = await sendTestTelegramToStreamerAction();
    setTesting(false);
    if (res.ok) {
      toast.success('Тест отправлен! Проверьте Telegram 📲');
    } else {
      toast.error(res.error, { duration: 7000 });
    }
  };

  const savedTgId = (initial.telegram_chat_id ?? '').trim();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display_name">Отображаемое имя</Label>
        <Input id="display_name" {...form.register('display_name')} />
        {form.formState.errors.display_name && (
          <p className="text-xs text-destructive">{form.formState.errors.display_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Телефон</Label>
        <Input id="phone" type="tel" placeholder="+7 999 010 0100" {...form.register('phone')} />
        {form.formState.errors.phone && (
          <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar_url">Ссылка на аватар</Label>
        <Input id="avatar_url" type="url" placeholder="https://…" {...form.register('avatar_url')} />
        {form.formState.errors.avatar_url && (
          <p className="text-xs text-destructive">{form.formState.errors.avatar_url.message}</p>
        )}
      </div>

      {/* ───────── Telegram block ───────── */}
      <div className="space-y-3 pt-2 border-t">
        <Label className="text-base">🔔 Telegram-уведомления</Label>

        {/* Step 1 */}
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/30 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-2 flex-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Шаг 1. Активируйте бота (обязательно!)
              </p>
              <p className="text-xs text-muted-foreground">
                Telegram запрещает ботам писать первыми. Откройте бота и нажмите{' '}
                <strong>Start</strong> — иначе уведомления НЕ БУДУТ приходить.
              </p>
              <Button asChild size="sm" variant="outline" type="button" className="gap-2">
                <a
                  href={`https://t.me/${BOT_USERNAME}?start=streamer`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Открыть @{BOT_USERNAME}
                  <ExternalLink className="size-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="space-y-2">
          <Label htmlFor="telegram_chat_id" className="text-sm">
            Шаг 2. Ваш Telegram Chat ID
          </Label>
          <Input
            id="telegram_chat_id"
            placeholder="Например: 1386670849"
            className="font-mono"
            {...form.register('telegram_chat_id')}
          />
          <p className="text-xs text-muted-foreground">
            Узнать ID:{' '}
            <a
              href="https://t.me/userinfobot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              @userinfobot <ExternalLink className="size-3" />
            </a>{' '}
            → Start → скопировать число → вставить сюда → сохранить.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          <span className="ml-2">Сохранить</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={testing || !savedTgId}
          title={!savedTgId ? 'Сначала сохраните ID' : 'Отправить тестовое уведомление'}
        >
          {testing ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
          <span className="ml-2">Отправить тест</span>
        </Button>
      </div>
    </form>
  );
}
