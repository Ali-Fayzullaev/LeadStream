'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Upload, Trash2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminUpdateSiteSettingsAction } from '@/app/admin/actions';

const ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/webp';
const MAX_BYTES = 2 * 1024 * 1024;

export function SiteSection({
  siteName,
  logoUrl,
}: {
  siteName: string;
  logoUrl: string | null;
}) {
  const [name, setName] = useState(siteName);
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

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}
