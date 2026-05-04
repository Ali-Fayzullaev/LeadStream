'use client';

import { useState } from 'react';
import { createManagerAction } from '@/app/manager/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export function CreateManagerForm() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const result = await createManagerAction(email, displayName, phone);

    if (result.success) {
      setSuccess(true);
      setTempPassword(result.tempPassword || '');
      setEmail('');
      setDisplayName('');
      setPhone('');
    } else {
      setError(result.error || 'Ошибка при создании менеджера');
    }

    setLoading(false);
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
          <code className="block font-mono text-sm font-bold text-primary break-all p-2 bg-background rounded border">
            {tempPassword}
          </code>
          <p className="text-xs text-muted-foreground">
            Предоставьте этот пароль менеджеру. Они смогут изменить его после первого входа.
          </p>
        </div>
        <Button
          onClick={() => {
            setSuccess(false);
            setTempPassword('');
          }}
          className="w-full"
        >
          Добавить еще
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input
          type="email"
          placeholder="manager@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">ФИО</label>
        <Input
          type="text"
          placeholder="Иван Петров"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Телефон</label>
        <Input
          type="tel"
          placeholder="+7 (999) 123-45-67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <Button className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        {loading ? 'Создание...' : 'Создать менеджера'}
      </Button>
    </form>
  );
}
