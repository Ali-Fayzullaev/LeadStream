import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { getAppSettings } from '@/lib/settings';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { site_name, logo_url } = await getAppSettings();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          {logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo_url} alt="" className="size-7 rounded-md object-contain" />
          ) : (
            <span className="size-7 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">L</span>
            </span>
          )}
          <span>{site_name}</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
