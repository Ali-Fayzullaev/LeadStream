'use client';

import { QRCodeCanvas } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/copy-button';

interface RefLinkCardProps {
  refCode: string;
  appUrl: string;
}

export function RefLinkCard({ refCode, appUrl }: RefLinkCardProps) {
  const link = `${appUrl.replace(/\/$/, '')}/?ref=${encodeURIComponent(refCode)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ваша реферальная ссылка</CardTitle>
        <CardDescription>Поделитесь ссылкой в TikTok-био. Каждый заказ через неё — ваш.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex-1 w-full space-y-3">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono break-all">
            {link}
          </div>
          <div className="flex gap-2">
            <CopyButton value={link} label="Копировать ссылку" />
            <CopyButton value={refCode} label="Копировать код" />
          </div>
          <p className="text-xs text-muted-foreground">
            Код: <code className="text-foreground">{refCode}</code>
          </p>
        </div>
        <div className="rounded-md bg-white p-3 shrink-0 self-center">
          <QRCodeCanvas value={link} size={128} level="M" includeMargin={false} />
        </div>
      </CardContent>
    </Card>
  );
}
