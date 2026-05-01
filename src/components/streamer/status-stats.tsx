'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';
import { ListChecks } from 'lucide-react';
import { useState } from 'react';

export interface StatusStatItem {
  key: string;
  label: string;
  color: string;
  count: number;
}

interface StatusStatsProps {
  items: StatusStatItem[];
}

const SIZE = 220;
const STROKE = 28;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function StatusStats({ items }: StatusStatsProps) {
  const total = items.reduce((acc, i) => acc + i.count, 0);
  const visible = items.filter((i) => i.count > 0);
  const [hover, setHover] = useState<string | null>(null);

  // Build arc segments along the circle.
  let cumulative = 0;
  const segments = visible.map((item) => {
    const fraction = total > 0 ? item.count / total : 0;
    const length = fraction * CIRC;
    const offset = cumulative;
    cumulative += length;
    return { ...item, fraction, length, offset };
  });

  const active = hover ? segments.find((s) => s.key === hover) : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15">
            <ListChecks className="size-4 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-base">Заявки по статусам</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Распределение ваших заявок</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {total === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Пока нет заявок</div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
            {/* Donut */}
            <div className="relative flex justify-center">
              <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="-rotate-90 drop-shadow-sm"
              >
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE}
                  className="text-muted/40"
                />
                {segments.map((s) => {
                  const isActive = hover === null || hover === s.key;
                  return (
                    <circle
                      key={s.key}
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={STROKE}
                      strokeDasharray={`${s.length} ${CIRC - s.length}`}
                      strokeDashoffset={-s.offset}
                      style={{
                        opacity: isActive ? 1 : 0.25,
                        transition: 'opacity 200ms ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={() => setHover(s.key)}
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
              </svg>

              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {active ? (
                  <>
                    <div
                      className="text-4xl font-black tabular-nums leading-none"
                      style={{ color: active.color }}
                    >
                      {Math.round(active.fraction * 100)}%
                    </div>
                    <div className="mt-1 text-xs font-medium text-muted-foreground max-w-[140px] text-center truncate">
                      {active.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                      {formatNumber(active.count)} заявок
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-black tabular-nums leading-none">
                      {formatNumber(total)}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      всего заявок
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {items.map((item) => {
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                const isActive = hover === item.key;
                return (
                  <div
                    key={item.key}
                    onMouseEnter={() => item.count > 0 && setHover(item.key)}
                    onMouseLeave={() => setHover(null)}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all"
                    style={{
                      borderColor: isActive ? `${item.color}99` : `${item.color}33`,
                      backgroundColor: isActive ? `${item.color}14` : 'transparent',
                      cursor: item.count > 0 ? 'pointer' : 'default',
                    }}
                  >
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="flex-1 truncate text-sm font-medium">{item.label}</span>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: item.color }}
                    >
                      {formatNumber(item.count)}
                    </span>
                    <span className="w-12 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
