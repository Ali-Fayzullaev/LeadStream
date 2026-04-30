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
import { adminUpdateProfileSchema, type AdminUpdateProfileInput } from '@/lib/validations';
import { adminUpdateProfileAction } from '@/app/admin/actions';

export function ProfileSection({ email, fullName }: { email: string; fullName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AdminUpdateProfileInput>({
    resolver: zodResolver(adminUpdateProfileSchema),
    defaultValues: { full_name: fullName },
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={email} readOnly disabled className="bg-muted/50" />
        <p className="text-xs text-muted-foreground">Email изменяется через техподдержку</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Имя</Label>
        <Input id="full_name" {...form.register('full_name')} />
        {form.formState.errors.full_name && (
          <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
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
