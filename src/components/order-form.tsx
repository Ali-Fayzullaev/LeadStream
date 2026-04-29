'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createOrderSchema, type CreateOrderInput } from '@/lib/validations';
import { getStoredRef } from './ref-tracker';

interface OrderFormProps {
  defaultProduct: string;
  defaultAmount?: number;
}

export function OrderForm({ defaultProduct, defaultAmount = 0 }: OrderFormProps) {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      productName: defaultProduct,
      quantity: 1,
      amount: defaultAmount,
    },
  });

  const onSubmit = async (data: CreateOrderInput) => {
    try {
      const ref = getStoredRef();
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, ref }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to place order');
      }

      toast.success('Order placed! We will contact you shortly.');
      setSubmitted(true);
      reset({ productName: defaultProduct, quantity: 1, amount: defaultAmount });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center"
      >
        <div className="text-2xl font-semibold">🎉 Thanks for your order!</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Our manager will call you within 15 minutes.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setSubmitted(false)}
        >
          Place another
        </Button>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      aria-busy={isSubmitting}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="customerName">Your name</Label>
        <Input
          id="customerName"
          autoComplete="name"
          placeholder="Jane Doe"
          {...register('customerName')}
        />
        {errors.customerName && (
          <p className="text-xs text-destructive">{errors.customerName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerPhone">Phone</Label>
        <Input
          id="customerPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 555 010 2233"
          {...register('customerPhone')}
        />
        {errors.customerPhone && (
          <p className="text-xs text-destructive">{errors.customerPhone.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="productName">Product</Label>
          <Input id="productName" {...register('productName')} />
        </div>
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min={1}
            max={999}
            {...register('quantity')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" rows={2} placeholder="Any details…" {...register('notes')} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="size-4" /> Place order
          </>
        )}
      </Button>
    </form>
  );
}
