'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrokerAction } from '@/app/broker/actions';

export function CreateBrokerForm() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await createBrokerAction(email, name, phone);
    setLoading(false);
    if (res.success) {
      setResult({ tempPassword: res.tempPassword });
      toast.success('Брокер создан!');
    } else {
      toast.error(res.error ?? 'Ошибка создания брокера');
    }
  };

  const copyPassword = () => {
    if (result) {
      navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-2">
          <p className="font-medium text-emerald-700 dark:text-emerald-400">✓ Брокер создан успешно!</p>
          <p className="text-sm text-muted-foreground">Передайте брокеру этот временный пароль:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm">{result.tempPassword}</code>
            <Button type="button" variant="outline" size="icon" onClick={copyPassword}>
              {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Брокер должен сменить пароль при первом входе.</p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => { setResult(null); setEmail(''); setName(''); setPhone(''); }}>
          Добавить ещё одного брокера
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="broker-name">Имя брокера *</Label>
        <Input id="broker-name" placeholder="Иван Иванов" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="broker-email">Email *</Label>
        <Input id="broker-email" type="email" placeholder="broker@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="broker-phone">Телефон</Label>
        <Input id="broker-phone" type="tel" placeholder="+7 700 123 45 67" value={phone} onChange={e => setPhone(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
        Создать брокера
      </Button>
    </form>
  );
}
