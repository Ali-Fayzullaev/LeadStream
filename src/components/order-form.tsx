'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Phone, User, MapPin, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
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

const NAME_MAX_LEN = 50;
const PHONE_MAX_LEN = 20;

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 15);
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

  // Step 1
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Step 2
  const [cityId, setCityId] = useState<string>('');
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  const [step, setStep] = useState<1 | 2>(1);

  // Consent checkbox: auto-checks as soon as the user starts typing in Step 1.
  // The flag itself is required at submit-time; users can untick it manually.
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    fetch('/api/cities', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: City[]) => {
        const list = Array.isArray(data) ? data : [];
        console.log('[order-form] cities loaded:', list.length);
        setCities(list);
      })
      .catch(err => {
        console.error('[order-form] failed to load cities:', err);
        setCities([]);
      })
      .finally(() => setCitiesLoading(false));
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.slice(0, NAME_MAX_LEN);
    setCustomerName(v);
    if (v.length > 0) setConsent(true);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setCustomerPhone(formatted);
    if (formatted.length > 0) setConsent(true);
    if (formatted && !isValidPhone(formatted)) {
      setPhoneError('Введите корректный номер (10–15 цифр)');
    } else {
      setPhoneError(null);
    }
  };

  // Step 1 → Step 2 (always go to city selection)
  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerPhone.trim()) {
      setPhoneError('Номер телефона обязателен');
      return;
    }
    if (!isValidPhone(customerPhone)) {
      setPhoneError('Введите корректный номер (10–15 цифр)');
      return;
    }
    if (!consent) {
      setError('Подтвердите согласие на обработку персональных данных');
      return;
    }

    setStep(2);
  };

  // Step 2 → Submit (city is OPTIONAL — saves anyway as "unassigned")
  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    submitOrder(cityId || null);
  };

  const submitOrder = (selectedCityId: string | null) => {
    start(async () => {
      try {
        setError(null);

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

        console.log('[order-form] submitting:', payload);

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        console.log('[order-form] response:', res.status, json);

        if (!res.ok) {
          const msg = json?.error ?? `Ошибка ${res.status}`;
          setError(msg);
          toast.error(msg);
          return;
        }
        toast.success('Заявка отправлена!');
        router.push(`/thanks?id=${encodeURIComponent(json.id)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Сетевая ошибка';
        console.error('[order-form] exception:', err);
        setError(msg);
        toast.error(msg);
      }
    });
  };

  // ── Step 1: Name + Phone ───────────────────────────────────────────────────
  if (step === 1) {
    return (
      <form onSubmit={handleStep1} className="space-y-5" noValidate>
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="customerName" className="flex items-center gap-1.5 text-sm font-medium">
            <User className="size-3.5 text-muted-foreground" />
            Ваше имя
          </Label>
          <Input
            id="customerName"
            autoComplete="name"
            placeholder="Иван"
            value={customerName}
            onChange={handleNameChange}
            maxLength={NAME_MAX_LEN}
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
            inputMode="tel"
            placeholder="+7 700 123 45 67"
            autoComplete="tel"
            value={customerPhone}
            onChange={handlePhoneChange}
            maxLength={PHONE_MAX_LEN}
            required
            className="h-11"
          />
          {phoneError && (
            <p className="text-xs text-destructive">{phoneError}</p>
          )}
        </div>

        {error && <p className="text-sm text-destructive break-words">{error}</p>}

        <Button
          type="submit"
          size="lg"
          className="w-full h-12 text-base font-semibold gap-2"
          disabled={pending}
        >
          Далее
          <ArrowRight className="size-4" />
        </Button>

        {/* Privacy consent — auto-checks as user types; tiny + low-contrast on purpose. */}
        <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-primary"
            aria-label="Согласие на обработку персональных данных"
          />
          <span className="text-[11px] leading-snug text-muted-foreground/80">
            Отправляя данные, вы даёте согласие на обработку персональных данных
            для связи и консультации.
          </span>
        </label>

        {streamerName && (
          <p className="text-center text-xs text-muted-foreground">
            Вас пригласил: <strong>{streamerName}</strong>
          </p>
        )}
      </form>
    );
  }

  // ── Step 2: City (optional) ────────────────────────────────────────────────
  return (
    <form onSubmit={handleStep2} className="space-y-5" noValidate>
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
        <span className="truncate">
          {customerName ? `${customerName} · ` : ''}{customerPhone}
        </span>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="ml-auto text-xs underline hover:text-foreground shrink-0 inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3" />
          Изменить
        </button>
      </div>

      {/* City */}
      <div className="space-y-2">
        <Label htmlFor="cityId" className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="size-3.5 text-muted-foreground" />
          Ваш город
        </Label>
        {citiesLoading ? (
          <div className="h-11 rounded-md bg-muted animate-pulse" />
        ) : cities.length === 0 ? (
          <div className="h-11 rounded-md border border-input bg-muted/40 px-3 flex items-center text-sm text-muted-foreground">
            Города ещё не настроены
          </div>
        ) : (
          <select
            id="cityId"
            value={cityId}
            onChange={e => setCityId(e.target.value)}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">— Не выбран —</option>
            {cities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-destructive break-words">{error}</p>}

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
