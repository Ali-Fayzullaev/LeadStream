'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateManagerTelegramAction } from './actions';

interface Props {
  managerId: string;
  currentChatId: string;
}

export function ManagerTelegramSection({ currentChatId }: Props) {
  const [chatId, setChatId] = useState(currentChatId);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    const res = await updateManagerTelegramAction(chatId.trim());
    setLoading(false);
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Telegram ID сохранён!');
    } else {
      toast.error(res.error ?? 'Ошибка сохранения');
    }
  };

  return (
    <div className="space-y-5">
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
          <li>Бот ответит вашим ID — скопируйте число (например: <code className="bg-muted px-1 rounded text-xs">1386670849</code>)</li>
          <li>Вставьте это число в поле ниже и нажмите «Сохранить»</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          После сохранения вы будете получать уведомления о новых лидах прямо в личку.
        </p>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <Label htmlFor="tg-id">Ваш Telegram ID</Label>
        <div className="flex gap-2">
          <Input
            id="tg-id"
            placeholder="Например: 1386670849"
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            className="font-mono"
          />
          <Button onClick={handleSave} disabled={loading || !chatId.trim()}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="size-4 text-emerald-500" />
            ) : (
              <Send className="size-4" />
            )}
            <span className="ml-2">{saved ? 'Сохранено!' : 'Сохранить'}</span>
          </Button>
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
