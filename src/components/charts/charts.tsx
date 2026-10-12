"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ValueFormat = "currency" | "number" | "percent";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

const nf = new Intl.NumberFormat("zh-TW");

function fmt(value: unknown, format: ValueFormat) {
  const n = Number(value ?? 0);
  if (format === "currency") return `NT$${nf.format(Math.round(n))}`;
  if (format === "percent") return `${(n * 100).toFixed(1)}%`;
  return nf.format(n);
}

function axisFmt(value: unknown, format: ValueFormat) {
  const n = Number(value ?? 0);
  if (format === "percent") return `${Math.round(n * 100)}%`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
};

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
}

export function TrendChart({
  data,
  xKey = "label",
  series,
  format = "currency",
  height = 280,
  variant = "area",
}: {
  data: Record<string, string | number>[];
  xKey?: string;
  series: SeriesDef[];
  format?: ValueFormat;
  height?: number;
  variant?: "area" | "line";
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {variant === "line" ? (
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => axisFmt(v, format)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v, format)} />
          {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? CHART_COLORS[i]}
              strokeWidth={2}
              dot={data.length <= 31}
            />
          ))}
        </LineChart>
      ) : (
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => axisFmt(v, format)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v, format)} />
          {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? CHART_COLORS[i]}
              fill={`url(#grad-${s.key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({
  data,
  xKey = "label",
  series,
  format = "currency",
  height = 280,
  horizontal = false,
  stacked = false,
}: {
  data: Record<string, string | number>[];
  xKey?: string;
  series: SeriesDef[];
  format?: ValueFormat;
  height?: number;
  horizontal?: boolean;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 16, left: horizontal ? 8 : 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => axisFmt(v, format)} />
        ) : (
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} minTickGap={8} />
        )}
        {horizontal ? (
          <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={false} width={130} interval={0} />
        ) : (
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => axisFmt(v, format)} />
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v, format)} cursor={{ fill: "var(--muted)" }} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? CHART_COLORS[i]}
            radius={(stacked ? [0, 0, 0, 0] : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) as [number, number, number, number]}
            stackId={stacked ? "a" : undefined}
            maxBarSize={horizontal ? 18 : 40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  format = "currency",
  height = 260,
}: {
  data: { name: string; value: number }[];
  format?: ValueFormat;
  height?: number;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-4 @md:flex-row">
      <div className="w-full @md:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(v, format)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 text-sm @md:w-1/2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="tabular-nums text-muted-foreground">{total ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}
