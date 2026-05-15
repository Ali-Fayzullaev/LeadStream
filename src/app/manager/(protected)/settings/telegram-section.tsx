'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Send,
  CheckCircle2,
  ExternalLink,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  updateManagerTelegramAction,
  sendTestTelegramToManagerAction,
} from './actions';

interface Props {
  managerId: string;
  currentChatId: string;
}

import { BOT_USERNAME } from '@/lib/bot';

export function ManagerTelegramSection({ currentChatId }: Props) {
  const [chatId, setChatId] = useState(currentChatId);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateManagerTelegramAction(chatId.trim());
    setSaving(false);
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Telegram ID сохранён!');
    } else {
      toast.error(res.error ?? 'Ошибка сохранения');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const res = await sendTestTelegramToManagerAction();
    setTesting(false);
    if (res.success) {
      toast.success('Тест отправлен! Проверьте Telegram 📲');
    } else {
      toast.error(res.error ?? 'Ошибка отправки', { duration: 7000 });
    }
  };

  return (
    <div className="space-y-5">
      {/* Step 1: Open the bot */}
      <div className="rounded-lg bg-amber-500/5 border border-amber-500/30 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-2 flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Шаг 1. Активируйте нашего бота (обязательно!)
            </p>
            <p className="text-xs text-muted-foreground">
              Telegram запрещает ботам писать первыми. Сначала откройте бота и нажмите{' '}
              <strong>Start</strong> — иначе уведомления приходить НЕ БУДУТ.
            </p>
            <Button asChild size="sm" variant="outline" className="gap-2">
              <a
                href={`https://t.me/${BOT_USERNAME}?start=manager`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть @{BOT_USERNAME}
                <ExternalLink className="size-3" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Step 2: get id */}
      <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4 space-y-3">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
          Шаг 2. Узнайте свой Telegram ID
        </p>
        <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>
            Откройте{' '}
            <a
              href="https://t.me/userinfobot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              @userinfobot <ExternalLink className="size-3" />
            </a>{' '}
            и нажмите <strong>Start</strong>
          </li>
          <li>
            Бот ответит вашим ID — скопируйте число (например:{' '}
            <code className="bg-muted px-1 rounded text-xs">1386670849</code>)
          </li>
          <li>Вставьте число в поле ниже и нажмите «Сохранить»</li>
          <li>Нажмите «Отправить тест» — проверьте, что уведомление пришло</li>
        </ol>
      </div>

      {/* Step 3: input */}
      <div className="space-y-2">
        <Label htmlFor="tg-id">Шаг 3. Ваш Telegram ID</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="tg-id"
            placeholder="Например: 1386670849"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="font-mono"
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || !chatId.trim()}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="ml-2">{saved ? 'Сохранено!' : 'Сохранить'}</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !currentChatId}
              title={
                !currentChatId
                  ? 'Сначала сохраните ID'
                  : 'Отправить тестовое уведомление'
              }
            >
              {testing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bell className="size-4" />
              )}
              <span className="ml-2 hidden sm:inline">Отправить тест</span>
            </Button>
          </div>
        </div>
        {currentChatId && (
          <p className="text-xs text-muted-foreground">
            Текущий ID: <code className="bg-muted px-1 rounded">{currentChatId}</code>
          </p>
        )}
      </div>
    </div>
  );
}
