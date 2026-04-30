'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateStreamerProfileSchema, type UpdateStreamerProfileInput } from '@/lib/validations';
import { updateStreamerProfileAction } from '@/app/streamer/actions';

interface ProfileFormProps {
  initial: UpdateStreamerProfileInput;
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [pending, start] = useTransition();
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
        <Label htmlFor="telegram_chat_id">Telegram Chat ID</Label>
        <Input id="telegram_chat_id" placeholder="123456789" {...form.register('telegram_chat_id')} />
        <p className="text-xs text-muted-foreground">
          Откройте <code>@LeadStreamBot</code> в Telegram, отправьте <code>/start</code> и вставьте полученный ID сюда, чтобы получать уведомления о заказах.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar_url">Ссылка на аватар</Label>
        <Input id="avatar_url" type="url" placeholder="https://…" {...form.register('avatar_url')} />
        {form.formState.errors.avatar_url && (
          <p className="text-xs text-destructive">{form.formState.errors.avatar_url.message}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Сохранить
      </Button>
    </form>
  );
}
