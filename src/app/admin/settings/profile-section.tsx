'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Mail, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  adminUpdateProfileSchema,
  adminUpdateEmailSchema,
  type AdminUpdateProfileInput,
  type AdminUpdateEmailInput,
} from '@/lib/validations';
import { adminUpdateProfileAction, adminUpdateEmailAction } from '@/app/admin/actions';

export function ProfileSection({ email, fullName }: { email: string; fullName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [emailPending, startEmail] = useTransition();
  const [emailError, setEmailError] = useState<string | null>(null);

  const form = useForm<AdminUpdateProfileInput>({
    resolver: zodResolver(adminUpdateProfileSchema),
    defaultValues: { full_name: fullName },
  });

  const emailForm = useForm<AdminUpdateEmailInput>({
    resolver: zodResolver(adminUpdateEmailSchema),
    defaultValues: { email, current_password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await adminUpdateProfileAction(values);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Профиль сохранён');
      router.refresh();
    });
  });

  const onEmailSubmit = emailForm.handleSubmit((values) => {
    setEmailError(null);
    startEmail(async () => {
      const res = await adminUpdateEmailAction(values);
      if (!res.ok) {
        setEmailError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Email изменён');
      emailForm.reset({ email: values.email, current_password: '' });
      router.refresh();
    });
  });

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name" className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            Имя
          </Label>
          <Input id="full_name" {...form.register('full_name')} />
          {form.formState.errors.full_name && (
            <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Сохранить имя
        </Button>
      </form>

      <div className="border-t pt-6">
        <div className="mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Mail className="size-4 text-amber-500" />
            Изменить email
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Текущий email: <span className="font-medium text-foreground">{email}</span>. Для смены
            подтвердите личность текущим паролем.
          </p>
        </div>
        <form onSubmit={onEmailSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_email">Новый email</Label>
            <Input
              id="new_email"
              type="email"
              autoComplete="email"
              {...emailForm.register('email')}
            />
            {emailForm.formState.errors.email && (
              <p className="text-xs text-destructive">{emailForm.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email_current_password">Текущий пароль</Label>
            <Input
              id="email_current_password"
              type="password"
              autoComplete="current-password"
              {...emailForm.register('current_password')}
            />
            {emailForm.formState.errors.current_password && (
              <p className="text-xs text-destructive">
                {emailForm.formState.errors.current_password.message}
              </p>
            )}
          </div>

          {emailError && <p className="text-sm text-destructive">{emailError}</p>}

          <Button type="submit" disabled={emailPending} variant="secondary">
            {emailPending && <Loader2 className="size-4 animate-spin" />}
            Сменить email
          </Button>
        </form>
      </div>
    </div>
  );
}
