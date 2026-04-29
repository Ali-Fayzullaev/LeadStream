'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  adminCreateStreamerSchema,
  type AdminCreateStreamerInput,
} from '@/lib/validations';
import { adminCreateStreamerAction } from '@/app/admin/actions';

export function CreateStreamerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AdminCreateStreamerInput>({
    resolver: zodResolver(adminCreateStreamerSchema),
    defaultValues: { fullName: '', email: '', password: '', refCode: '', commissionPercent: 10 },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await adminCreateStreamerAction(values);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Стример создан и активирован');
      form.reset();
      setOpen(false);
      router.refresh();
    });
  });

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Добавить стримера</Button>;
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Создать стримера</h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Отмена</Button>
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Полное имя" error={form.formState.errors.fullName?.message}>
          <Input {...form.register('fullName')} />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" {...form.register('email')} />
        </Field>
        <Field label="Пароль" error={form.formState.errors.password?.message}>
          <Input type="text" {...form.register('password')} />
        </Field>
        <Field label="Реф-код" error={form.formState.errors.refCode?.message}>
          <Input {...form.register('refCode')} />
        </Field>
        <Field label="Комиссия %" error={form.formState.errors.commissionPercent?.message}>
          <Input type="number" min={0} max={100} step={0.1} {...form.register('commissionPercent')} />
        </Field>
        <div className="sm:col-span-2 flex items-center justify-between">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="ml-auto">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Создать и активировать
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
