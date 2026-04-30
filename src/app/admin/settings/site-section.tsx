'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Upload, Trash2, ImageIcon, Send, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminUpdateSiteSettingsAction } from '@/app/admin/actions';

const ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/webp';
const MAX_BYTES = 2 * 1024 * 1024;

export function SiteSection({
  siteName,
  logoUrl,
  adminTelegramChatId,
}: {
  siteName: string;
  logoUrl: string | null;
  adminTelegramChatId: string | null;
}) {
  const [name, setName] = useState(siteName);
  const [tgChatId, setTgChatId] = useState(adminTelegramChatId ?? '');
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error('Файл слишком большой (макс. 2 MB)');
      e.target.value = '';
      return;
    }
    setPickedFile(f);
    setRemoved(false);
    setPreview(URL.createObjectURL(f));
  }

  function onRemove() {
    setPickedFile(null);
    setPreview(null);
    setRemoved(true);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set('site_name', name);
    fd.set('admin_telegram_chat_id', tgChatId.trim());
    if (pickedFile) fd.set('logo', pickedFile);
    if (removed && !pickedFile) fd.set('remove_logo', '1');

    startTransition(async () => {
      const res = await adminUpdateSiteSettingsAction(fd);
      if (res.ok) {
        toast.success('Сохранено');
        setPickedFile(null);
        setRemoved(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  const dirty =
    name.trim() !== siteName.trim() ||
    tgChatId.trim() !== (adminTelegramChatId ?? '').trim() ||
    pickedFile !== null ||
    (removed && logoUrl !== null);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="site_name">Имя сайта</Label>
        <Input
          id="site_name"
          name="site_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="LeadStream"
          maxLength={60}
          required
        />
        <p className="text-xs text-muted-foreground">
          Отображается в шапке кабинета, на публичном лендинге и в письмах.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Логотип</Label>
        <div className="flex items-center gap-4">
          <div className="size-20 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Логотип" className="size-full object-contain" />
            ) : (
              <ImageIcon className="size-7 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={onPickFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="gap-2"
            >
              <Upload className="size-4" />
              {preview ? 'Заменить' : 'Загрузить'}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={pending}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                Удалить
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPG, SVG или WEBP, до 2 MB. Рекомендованный размер — 256×256.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <Label htmlFor="admin_telegram_chat_id" className="flex items-center gap-2">
          <Send className="size-4 text-sky-500" />
          Telegram уведомления админа
        </Label>
        <Input
          id="admin_telegram_chat_id"
          name="admin_telegram_chat_id"
          value={tgChatId}
          onChange={(e) => setTgChatId(e.target.value)}
          placeholder="123456789"
          inputMode="numeric"
          pattern="-?\d*"
          maxLength={32}
        />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Куда бот будет присылать уведомления о новых заказах. Оставьте пустым, чтобы отключить.</p>
          <p className="font-medium text-foreground">Как узнать свой chat ID:</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>
              Откройте бота{' '}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-sky-600 hover:underline dark:text-sky-400"
              >
                @userinfobot <ExternalLink className="size-3" />
              </a>{' '}
              и нажмите Start — он пришлёт ваш ID.
            </li>
            <li>
              Затем напишите вашему боту LeadStream любое сообщение (иначе бот не сможет вам писать).
            </li>
            <li>Для группы добавьте бота админом и используйте ID группы (со знаком минус).</li>
          </ol>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}
