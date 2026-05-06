'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getBrokerProfileAction, updateBrokerTelegramAction } from '@/app/broker/actions';
import { Loader2, Send, CheckCircle2, ExternalLink } from 'lucide-react';

export default function BrokerProfilePage() {
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string; email: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    getBrokerProfileAction().then((res) => {
      if (res.success && res.broker) {
        setTelegramId(res.broker.telegram_chat_id ?? '');
        setProfile({ display_name: res.broker.display_name, email: res.broker.email });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateBrokerTelegramAction(telegramId);
    setSaving(false);
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Telegram ID сохранён!');
    } else {
      toast.error(res.error ?? 'Ошибка сохранения');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Профиль" description="Настройки вашего аккаунта" />

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Мои данные</CardTitle>
            <CardDescription>Ваши данные в системе</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Имя</span>
              <span className="text-sm font-medium">{profile.display_name}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{profile.email}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" />
            🔔 Telegram уведомления
          </CardTitle>
          <CardDescription>
            Получайте новые лиды прямо в личку Telegram — мгновенно, без задержек.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Instruction */}
          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4 space-y-3">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
              📱 Как узнать свой Telegram ID?
            </p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>
                Откройте Telegram и найдите бота{' '}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                >
                  @userinfobot <ExternalLink className="size-3" />
                </a>
              </li>
              <li>Нажмите <strong>Start</strong> или отправьте любое сообщение</li>
              <li>
                Бот ответит вашим ID — скопируйте число
                (например: <code className="bg-muted px-1 rounded text-xs">1386670849</code>)
              </li>
              <li>Вставьте это число в поле ниже и нажмите «Сохранить»</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              После сохранения вы будете получать уведомления о новых лидах прямо в личку.
            </p>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <Label htmlFor="tgid">Ваш Telegram ID</Label>
            <div className="flex gap-2">
              <Input
                id="tgid"
                placeholder="Например: 1386670849"
                value={loading ? '' : telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                disabled={loading}
                className="font-mono"
              />
              <Button onClick={handleSave} disabled={saving || loading || !telegramId.trim()}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <Send className="size-4" />
                )}
                <span className="ml-2">{saved ? 'Сохранено!' : 'Сохранить'}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Только цифры. Например: 1386670849</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
