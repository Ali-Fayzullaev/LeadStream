'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getBrokerProfileAction, updateBrokerTelegramAction } from '@/app/broker/actions';
import { Loader2, Send } from 'lucide-react';

export default function BrokerProfilePage() {
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    getBrokerProfileAction().then((res) => {
      if (res.success && res.broker) {
        setTelegramId(res.broker.telegram_chat_id ?? '');
      }
      setFetching(false);
    });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    const res = await updateBrokerTelegramAction(telegramId);
    setLoading(false);
    if (res.success) toast.success('Telegram ID сохранён');
    else toast.error(res.error ?? 'Ошибка');
  };

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Профиль" description="Настройки вашего аккаунта брокера" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" />
            Telegram уведомления
          </CardTitle>
          <CardDescription>
            Укажите ваш Telegram Chat ID чтобы получать уведомления о новых лидах в личку.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/50 border p-4 text-sm space-y-2">
            <p className="font-medium">Как узнать свой Telegram Chat ID:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Откройте Telegram и найдите бота <code className="bg-muted px-1 rounded">@userinfobot</code></li>
              <li>Напишите ему любое сообщение (например <code className="bg-muted px-1 rounded">/start</code>)</li>
              <li>Бот ответит вашим ID — скопируйте число и вставьте ниже</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tgid">Ваш Telegram Chat ID</Label>
            <Input
              id="tgid"
              placeholder="123456789"
              value={fetching ? '' : telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              disabled={fetching}
            />
            <p className="text-xs text-muted-foreground">Только цифры. Например: 123456789</p>
          </div>

          <Button onClick={handleSave} disabled={loading || fetching}>
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Сохранить
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
