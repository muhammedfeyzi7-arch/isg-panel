"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { formatCompact, formatMoney } from "@solofin/core/finance/money";

export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"] as const;

const axisProps = {
  stroke: "var(--chart-axis)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

function MoneyTooltip({ active, payload, label, labelFormatter }: TooltipProps<number, string> & { labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-fg">{labelFormatter ? labelFormatter(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tnum font-medium text-fg">{formatMoney(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

function LegendText(value: string) {
  return <span className="text-xs text-muted">{value}</span>;
}

interface SeriesDef {
  key: string;
  name: string;
  color?: string;
  dashed?: boolean;
}

export function MoneyBarChart({
  data,
  xKey,
  series,
  height = 240,
  xFormatter,
  ariaLabel,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: SeriesDef[];
  height?: number;
  xFormatter?: (v: string) => string;
  ariaLabel: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} />
          <YAxis {...axisProps} width={56} tickFormatter={(v) => formatCompact(Number(v))} />
          <Tooltip cursor={{ fill: "var(--chart-grid)", opacity: 0.5 }} content={<MoneyTooltip labelFormatter={xFormatter} />} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} formatter={LegendText} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color ?? SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MoneyLineChart({
  data,
  xKey,
  series,
  height = 240,
  xFormatter,
  ariaLabel,
  zeroLine,
  area,
  zeroBased,
}: {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: SeriesDef[];
  height?: number;
  xFormatter?: (v: string) => string;
  ariaLabel: string;
  zeroLine?: boolean;
  area?: boolean;
  zeroBased?: boolean;
}) {
  // Recharts 2 fragment içindeki çocukları tanımadığı için ortak öğeler dizi olarak verilir.
  const common = [
    <CartesianGrid key="grid" vertical={false} stroke="var(--chart-grid)" />,
    <XAxis key="x" dataKey={xKey} {...axisProps} tickFormatter={xFormatter} minTickGap={24} />,
    <YAxis key="y" {...axisProps} width={56} domain={zeroBased ? [0, "auto"] : ["auto", "auto"]} tickFormatter={(v) => formatCompact(Number(v))} />,
    <Tooltip key="tt" content={<MoneyTooltip labelFormatter={xFormatter} />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />,
    series.length > 1 ? <Legend key="lg" iconType="circle" iconSize={8} formatter={LegendText} /> : null,
    zeroLine ? <ReferenceLine key="zero" y={0} stroke="var(--chart-axis)" strokeDasharray="4 4" /> : null,
  ];
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color ?? SERIES[i]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color ?? SERIES[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {common}
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color ?? SERIES[i]}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                fill={`url(#grad-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--surface))" }}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            {common}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color ?? SERIES[i]}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--surface))" }}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
