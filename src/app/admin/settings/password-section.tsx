'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminChangePasswordSchema, type AdminChangePasswordInput } from '@/lib/validations';
import { adminChangePasswordAction } from '@/app/admin/actions';

export function PasswordSection() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const form = useForm<AdminChangePasswordInput>({
    resolver: zodResolver(adminChangePasswordSchema),
    defaultValues: { current_password: '', new_password: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await adminChangePasswordAction(values);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Пароль обновлён');
      form.reset();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" method="post" action="#">
      <div className="space-y-2">
        <Label htmlFor="current_password">Текущий пароль</Label>
        <div className="relative">
          <Input
            id="current_password"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            {...form.register('current_password')}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_password">Новый пароль</Label>
        <div className="relative">
          <Input
            id="new_password"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            {...form.register('new_password')}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {form.formState.errors.new_password && (
          <p className="text-xs text-destructive">{form.formState.errors.new_password.message}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Обновить пароль
      </Button>
    </form>
  );
}
