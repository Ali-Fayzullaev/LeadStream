'use client';

import { Button } from '@/components/ui/button';

export type RangePreset = 'today' | 'week' | 'month' | 'all';

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All time' },
];

/** Convert preset to a {from,to} range. */
export function presetToRange(p: RangePreset): { from?: Date; to?: Date } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);

  switch (p) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      return { from, to };
    case 'week':
      from.setDate(now.getDate() - 7);
      return { from, to };
    case 'month':
      from.setDate(now.getDate() - 30);
      return { from, to };
    case 'all':
    default:
      return {};
  }
}

export function DateRangeBar({
  preset,
  onChange,
}: {
  preset: RangePreset;
  onChange: (p: RangePreset) => void;
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {PRESETS.map((p) => (
        <Button
          key={p.value}
          size="sm"
          variant={preset === p.value ? 'default' : 'ghost'}
          className="h-8"
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
