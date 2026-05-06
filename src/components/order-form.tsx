'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Phone, User, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface City { id: string; name: string; slug: string; }

interface OrderFormProps {
  refCode: string | null;
  streamerName: string | null;
  defaultProductName?: string;
  defaultAmount?: number;
  disableAttribution?: boolean;
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.startsWith('7') || digits.startsWith('8')) {
    const d = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
    const p = d.slice(1);
    let result = '+7';
    if (p.length > 0) result += ' ' + p.slice(0, 3);
    if (p.length > 3) result += ' ' + p.slice(3, 6);
    if (p.length > 6) result += ' ' + p.slice(6, 8);
    if (p.length > 8) result += ' ' + p.slice(8, 10);
    return result;
  }
  return '+' + digits;
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
  const [hp, setHp] = useState('');

  // Step 1 fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Step 2 fields
  const [cityId, setCityId] = useState<string>('');
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  // Step: 1 = name+phone, 2 = city
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    fetch('/api/cities')
      .then(r => r.json())
      .then((data: City[]) => {
        setCities(data ?? []);
        if (data?.length === 1) setCityId(data[0].id);
      })
      .catch(() => setCities([]))
      .finally(() => setCitiesLoading(false));
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setCustomerPhone(formatted);
    if (formatted && !isValidPhone(formatted)) {
      setPhoneError('Введите корректный номер (10–15 цифр)');
    } else {
      setPhoneError(null);
    }
  };

  // Step 1 → Step 2
  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (hp) { toast.success('Заявка отправлена'); return; }
    if (!customerPhone.trim()) { setPhoneError('Номер телефона обязателен'); return; }
    if (!isValidPhone(customerPhone)) { setPhoneError('Введите корректный номер'); return; }

    // If no cities — skip step 2 and submit directly
    if (!citiesLoading && cities.length === 0) {
      submitOrder(null);
      return;
    }
    setStep(2);
  };

  // Step 2 → Submit
  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    submitOrder(cityId || null);
  };

  const submitOrder = (selectedCityId: string | null) => {
    start(async () => {
      const payload: Record<string, unknown> = {
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim(),
        productName: defaultProductName ?? 'Заявка',
        quantity: 1,
        amount: defaultAmount ?? 0,
        cityId: selectedCityId,
      };

      if (!disableAttribution && refCode) {
        payload.ref = refCode;
      } else if (disableAttribution) {
        payload._no_attribution = true;
      }

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
        setStep(1);
        return;
      }
      toast.success('Заявка отправлена!');
      router.push(`/thanks?id=${encodeURIComponent(json.id)}`);
    });
  };

  // ── Step 1: Name + Phone ───────────────────────────────────────────────────
  if (step === 1) {
    return (
      <form onSubmit={handleStep1} className="space-y-5">
        {/* Honeypot */}
        <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden opacity-0">
          <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={e => setHp(e.target.value)} />
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="customerName" className="flex items-center gap-1.5 text-sm font-medium">
            <User className="size-3.5 text-muted-foreground" />
            Ваше имя
            <span className="text-muted-foreground font-normal text-xs">(необязательно)</span>
          </Label>
          <Input
            id="customerName"
            autoComplete="name"
            placeholder="Иван Иванов"
            value={customerName}
            onChange={e => setCustomerName(e.target.value.slice(0, 50))}
            maxLength={50}
            className="h-11"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="customerPhone" className="flex items-center gap-1.5 text-sm font-medium">
            <Phone className="size-3.5 text-muted-foreground" />
            Номер телефона
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customerPhone"
            type="tel"
            placeholder="+7 700 123 45 67"
            autoComplete="tel"
            value={customerPhone}
            onChange={handlePhoneChange}
            required
            className="h-11"
          />
          {phoneError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              {phoneError}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          size="lg"
          className="w-full h-12 text-base font-semibold gap-2"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              Далее
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
    );
  }

  // ── Step 2: City ───────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleStep2} className="space-y-5">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
        <span className="truncate">
          {customerName ? `${customerName} · ` : ''}{customerPhone}
        </span>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="ml-auto text-xs underline hover:text-foreground shrink-0"
        >
          Изменить
        </button>
      </div>

      {/* City */}
      <div className="space-y-2">
        <Label htmlFor="cityId" className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="size-3.5 text-muted-foreground" />
          Ваш город
          <span className="text-muted-foreground font-normal text-xs">(необязательно)</span>
        </Label>
        {citiesLoading ? (
          <div className="h-11 rounded-md bg-muted animate-pulse" />
        ) : (
          <select
            id="cityId"
            value={cityId}
            onChange={e => setCityId(e.target.value)}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">— Выберите город —</option>
            {cities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <p className="text-xs text-muted-foreground">
          Укажите город, чтобы мы быстрее связались с вами.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base font-semibold gap-2"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          'Отправить заявку'
        )}
      </Button>
    </form>
  );
}
