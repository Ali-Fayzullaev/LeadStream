'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, ShoppingBag } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createOrderSchema, type CreateOrderInput } from '@/lib/validations';

interface OrderFormProps {
  refCode: string | null;
  streamerName: string | null;
  defaultProductName?: string;
  defaultAmount?: number;
}

export function OrderForm({ refCode, streamerName, defaultProductName, defaultAmount }: OrderFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      productName: defaultProductName ?? 'Заказ',
      quantity: 1,
      amount: defaultAmount ?? 0,
      notes: '',
      ref: refCode ?? undefined,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error ?? 'Ошибка при оформлении заказа';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Заказ оформлен!');
      router.push(`/thanks?id=${encodeURIComponent(json.id)}`);
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="customerName">Ваше имя</Label>
        <Input id="customerName" autoComplete="name" placeholder="Иван Иванов" {...form.register('customerName')} />
        {form.formState.errors.customerName && (
          <p className="text-xs text-destructive">{form.formState.errors.customerName.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="customerPhone">Номер телефона</Label>
        <Input id="customerPhone" type="tel" placeholder="+7 999 123 45 67" autoComplete="tel" {...form.register('customerPhone')} />
        {form.formState.errors.customerPhone && (
          <p className="text-xs text-destructive">{form.formState.errors.customerPhone.message}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
        Оставить заявку
      </Button>
    </form>
  );
}
