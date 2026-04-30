'use client';

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface OrdersChartProps {
  data: { day: string; orders: number; revenue: number }[];
  height?: number;
}

const TNG = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 });

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: unknown[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload as Array<{ dataKey: string; value: number; color: string }>;
  const orders = p.find((x) => x.dataKey === 'orders')?.value ?? 0;
  const revenue = p.find((x) => x.dataKey === 'revenue')?.value ?? 0;
  return (
    <div className="rounded-lg border bg-popover/95 backdrop-blur px-3 py-2 shadow-lg text-xs">
      <div className="font-medium mb-1.5">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-violet-500" />
            Заказы
          </span>
          <span className="font-semibold tabular-nums">{orders}</span>
        </div>
        <div className="flex items-center gap-2 justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            Выручка
          </span>
          <span className="font-semibold tabular-nums">{TNG.format(revenue)} ₸</span>
        </div>
      </div>
    </div>
  );
}

export function OrdersChart({ data, height = 280 }: OrdersChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rev-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="orders-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="day"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          yAxisId="left"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} content={<CustomTooltip />} />
        <Legend
          align="right"
          verticalAlign="top"
          iconType="circle"
          wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
        />
        <Bar
          yAxisId="left"
          dataKey="orders"
          name="Заказы"
          fill="url(#orders-bar)"
          radius={[6, 6, 0, 0]}
          maxBarSize={28}
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="revenue"
          name="Выручка"
          stroke="#10b981"
          strokeWidth={2.25}
          fill="url(#rev-area)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
