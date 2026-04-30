import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { getAppSettings } from '@/lib/settings';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export async function generateMetadata(): Promise<Metadata> {
  const { site_name, logo_url } = await getAppSettings();
  return {
    title: { default: site_name, template: `%s — ${site_name}` },
    description:
      'Track orders that come from your TikTok streamers. Real-time stats, per-streamer attribution, and instant Telegram notifications.',
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    icons: logo_url ? { icon: logo_url } : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Defensive: this app does NOT register any Service Worker.
          If a stale SW is left over from another dev project on the same origin
          (localhost:3000), it intercepts /_next/* chunks and breaks the app.
          This inline script runs BEFORE any webpack chunk loads.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){if(!rs.length)return;Promise.all(rs.map(function(r){return r.unregister()})).then(function(){if(typeof caches!=='undefined'){caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}).finally(function(){location.reload()})}else{location.reload()}})})}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
