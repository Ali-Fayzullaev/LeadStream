'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, ShoppingBag, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Turnstile } from '@/components/turnstile';
import { createOrderSchema, type CreateOrderInput } from '@/lib/validations';

interface OrderFormProps {
  refCode: string | null;
  streamerName: string | null;
  defaultProductName?: string;
  defaultAmount?: number;
  /** When true, the API will ignore body.ref and the cookie — order won't be attributed. */
  disableAttribution?: boolean;
}

export function OrderForm({
  refCode,
  streamerName,
  defaultProductName,
  defaultAmount,
  disableAttribution = false,
}: OrderFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Honeypot — hidden field bots fill, humans don't see.
  const [hp, setHp] = useState('');

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      productName: defaultProductName ?? 'Заявка',
      quantity: 1,
      amount: defaultAmount ?? 0,
      notes: '',
      ref: disableAttribution ? undefined : (refCode ?? undefined),
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    if (hp) {
      // Silent honeypot trip — pretend to succeed.
      toast.success('Заявка отправлена');
      return;
    }
    if (!captchaToken) {
      setError('Подождите проверку безопасности и попробуйте снова.');
      return;
    }
    start(async () => {
      const payload = disableAttribution
        ? { ...values, ref: null, _no_attribution: true, _ts: captchaToken }
        : { ...values, _ts: captchaToken };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error ?? 'Ошибка при отправке заявки';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Заявка отправлена!');
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
        <Input id="customerPhone" type="tel" placeholder="+7 700 123 45 67" autoComplete="tel" {...form.register('customerPhone')} />
        {form.formState.errors.customerPhone && (
          <p className="text-xs text-destructive">{form.formState.errors.customerPhone.message}</p>
        )}
      </div>

      {/* Honeypot (hidden from real users) */}
      <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden opacity-0">
        <label>
          Не заполняйте это поле
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </label>
      </div>

      {/* Cloudflare Turnstile — silent bot check */}
      <Turnstile onToken={setCaptchaToken} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending || !captchaToken}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
        Оставить заявку
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3" />
        Защита от ботов: Cloudflare Turnstile
      </p>
    </form>
  );
}
