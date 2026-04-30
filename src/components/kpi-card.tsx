'use client';

import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  /** Tone of the icon plate gradient. */
  tone?: 'violet' | 'emerald' | 'sky' | 'amber' | 'rose';
  /** Sparkline series — last N values. */
  series?: number[];
  /** Percent delta vs prior period; positive = up. */
  delta?: number;
  className?: string;
}

const TONES: Record<NonNullable<KpiCardProps['tone']>, { from: string; to: string; ring: string; spark: string }> = {
  violet:  { from: 'from-violet-500',  to: 'to-fuchsia-500',  ring: 'ring-violet-500/20',  spark: '#a855f7' },
  emerald: { from: 'from-emerald-500', to: 'to-teal-500',     ring: 'ring-emerald-500/20', spark: '#10b981' },
  sky:     { from: 'from-sky-500',     to: 'to-indigo-500',   ring: 'ring-sky-500/20',     spark: '#0ea5e9' },
  amber:   { from: 'from-amber-500',   to: 'to-orange-500',   ring: 'ring-amber-500/20',   spark: '#f59e0b' },
  rose:    { from: 'from-rose-500',    to: 'to-pink-500',     ring: 'ring-rose-500/20',    spark: '#f43f5e' },
};

export function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = 'violet',
  series,
  delta,
  className,
}: KpiCardProps) {
  const t = TONES[tone];
  const sparkData = (series ?? []).map((v, i) => ({ i, v }));
  const positive = (delta ?? 0) >= 0;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-5 transition-all',
        'hover:shadow-lg hover:-translate-y-0.5',
        className,
      )}
    >
      {/* decorative gradient blob */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-20 blur-3xl bg-gradient-to-br',
          t.from,
          t.to,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-3 min-w-0">
          <div
            className={cn(
              'inline-flex size-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm ring-4',
              t.from,
              t.to,
              t.ring,
            )}
          >
            <span className="[&>svg]:size-5">{icon}</span>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="text-3xl font-bold tracking-tight tabular-nums leading-none">
              {value}
            </div>
            {(hint || typeof delta === 'number') && (
              <div className="flex items-center gap-2 text-xs">
                {typeof delta === 'number' && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
                      positive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {Math.abs(delta).toFixed(1)}%
                  </span>
                )}
                {hint && <span className="text-muted-foreground truncate">{hint}</span>}
              </div>
            )}
          </div>
        </div>

        {sparkData.length > 1 && (
          <div className="w-24 h-14 shrink-0 self-end opacity-90">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.spark} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={t.spark} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={t.spark}
                  strokeWidth={1.75}
                  fill={`url(#spark-${tone})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
