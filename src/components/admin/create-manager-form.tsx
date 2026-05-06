'use client';

import { useState, useEffect } from 'react';
import { createManagerAction } from '@/app/manager/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { CheckCircle, Loader2, AlertCircle, Copy, Check } from 'lucide-react';

interface City { id: string; name: string; slug: string; }

export function CreateManagerForm() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [cityId, setCityId] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/cities', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: City[]) => {
        console.log('[create-manager] cities loaded:', data);
        setCities(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('[create-manager] failed to load cities:', err);
        setCities([]);
      })
      .finally(() => setCitiesLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const result = await createManagerAction(email, displayName, phone, cityId || undefined);
      console.log('[create-manager] result:', result);

      if (result.success) {
        setSuccess(true);
        setTempPassword(result.tempPassword || '');
        setEmail('');
        setDisplayName('');
        setPhone('');
        setCityId('');
      } else {
        setError(result.error || 'Не удалось создать менеджера');
      }
    } catch (err) {
      console.error('[create-manager] exception:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при создании менеджера');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (success && tempPassword) {
    return (
      <div className="space-y-4">
        <Alert className="border-emerald-500/50 bg-emerald-500/10">
          <CheckCircle className="size-4 text-emerald-600" />
          <AlertDescription className="text-emerald-600">
            Менеджер успешно создан!
          </AlertDescription>
        </Alert>
        <div className="space-y-2 p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">Временный пароль:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm font-bold text-primary break-all p-2 bg-background rounded border">
              {tempPassword}
            </code>
            <Button type="button" variant="outline" size="icon" onClick={copyPassword}>
              {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Предоставьте этот пароль менеджеру. Они смогут изменить его после первого входа.
          </p>
        </div>
        <Button onClick={() => { setSuccess(false); setTempPassword(''); }} className="w-full">
          Добавить ещё
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="break-all">{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Email *</Label>
        <Input type="email" placeholder="manager@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} required />
      </div>

      <div className="space-y-2">
        <Label>ФИО *</Label>
        <Input type="text" placeholder="Иван Петров" value={displayName} onChange={e => setDisplayName(e.target.value)} disabled={loading} required />
      </div>

      <div className="space-y-2">
        <Label>Телефон</Label>
        <Input type="tel" placeholder="+7 (999) 123-45-67" value={phone} onChange={e => setPhone(e.target.value)} disabled={loading} />
      </div>

      <div className="space-y-2">
        <Label>Город {citiesLoading && <span className="text-xs text-muted-foreground">(загрузка...)</span>}</Label>
        <select
          value={cityId}
          onChange={e => setCityId(e.target.value)}
          disabled={loading || citiesLoading}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">— Без города —</option>
          {cities.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {cities.length > 0
            ? `Доступно городов: ${cities.length}. Лиды из выбранного города будут назначаться этому менеджеру.`
            : 'Городов нет. Добавьте города в Настройках.'}
        </p>
      </div>

      <Button className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {loading ? 'Создание...' : 'Создать менеджера'}
      </Button>
    </form>
  );
}
