import { Suspense } from 'react';
import { ShoppingBag, Sparkles, Truck, ShieldCheck, Star } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { RefTracker } from '@/components/ref-tracker';
import { OrderForm } from '@/components/order-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PRODUCT = {
  name: 'Aurora Smart Lamp',
  price: 49.99,
  oldPrice: 89.99,
  rating: 4.9,
  reviews: 1284,
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-[500px] translate-x-1/3 translate-y-1/3 rounded-full bg-pink-500/20 blur-3xl" />

      <Suspense fallback={null}>
        <RefTracker />
      </Suspense>

      <header className="container relative flex items-center justify-between py-6">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Sparkles className="size-5 text-primary" /> LeadStream
        </div>
        <ThemeToggle />
      </header>

      <main className="container relative grid gap-12 pb-20 pt-8 md:grid-cols-2 md:gap-16 md:pt-16">
        <section className="flex flex-col justify-center">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border bg-background/50 px-3 py-1 text-xs backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live on TikTok • limited stock
          </div>

          <h1 className="text-balance text-4xl font-bold leading-tight md:text-6xl">
            <span className="gradient-text">{PRODUCT.name}</span>
            <br />
            that adapts to your mood.
          </h1>

          <p className="mt-5 max-w-prose text-base text-muted-foreground md:text-lg">
            16 million colors, voice control, and a butter-smooth dimmer.
            Loved by streamers — now yours at 45% off.
          </p>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-4xl font-bold">${PRODUCT.price.toFixed(2)}</span>
            <span className="text-lg text-muted-foreground line-through">
              ${PRODUCT.oldPrice.toFixed(2)}
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              -45%
            </span>
          </div>

          <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
            ))}
            <span className="ml-1">
              {PRODUCT.rating} · {PRODUCT.reviews.toLocaleString()} reviews
            </span>
          </div>

          <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
            <Feature icon={Truck} title="Free shipping" sub="2-day delivery" />
            <Feature icon={ShieldCheck} title="2-year warranty" sub="No questions asked" />
            <Feature icon={ShoppingBag} title="30-day returns" sub="Hassle free" />
          </ul>
        </section>

        <section className="flex items-center">
          <Card className="glass w-full shadow-xl">
            <CardHeader>
              <CardTitle>Order in 30 seconds</CardTitle>
              <CardDescription>
                Drop your phone — our team will confirm by call.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrderForm defaultProduct={PRODUCT.name} defaultAmount={PRODUCT.price} />
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="container relative border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LeadStream. All rights reserved.
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}) {
  return (
    <li className="flex items-start gap-2 rounded-lg border bg-background/40 p-3 backdrop-blur">
      <Icon className="mt-0.5 size-4 text-primary" />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </li>
  );
}
