"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shares as fmtShares } from "@/lib/format";
import { cagr } from "@/lib/projections";
import {
  axisProps,
  ChartFrame,
  ChartTooltip,
  DataTable,
  gridProps,
} from "@/components/charts/chart-kit";
import { EmptyState } from "@/components/ui";

export type SharePoint = { period: string; shares: number };

/**
 * Shares outstanding over time. One series, so no legend box — the title names
 * it — with the endpoint direct-labeled rather than a number on every point.
 */
export function ShareCountChart({
  symbol,
  points,
}: {
  symbol: string;
  points: SharePoint[];
}) {
  if (points.length < 2) {
    return (
      <div className="bg-surface border border-hairline rounded-xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold tracking-tight mb-4">
          Shares outstanding
        </h2>
        <EmptyState title="No share history available">
          Yahoo returned fewer than two annual periods for {symbol}, so there&rsquo;s
          nothing to plot. Funds and ETFs don&rsquo;t report a share count this way.
        </EmptyState>
      </div>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const totalChange = ((last.shares - first.shares) / first.shares) * 100;
  const shrinking = totalChange < 0;
  // Annualized, so it's directly comparable to the share-count-trend field.
  const perYear = cagr(first.shares, last.shares, points.length - 1);

  /**
   * Recharts' "auto" domain fits the data exactly, which turns a 0.1% drift
   * into a dramatic S-curve — the chart would contradict its own caption. Floor
   * the visible range at ±3% of the mean so a flat share count reads as flat
   * and a real buyback still fills the plot.
   */
  const values = points.map((p) => p.shares);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const floor = mean * 0.03;
  const spread = Math.max(Math.max(...values) - Math.min(...values), floor);
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  // Snap the bounds outward to whole millions so the ticks come out round.
  const domain: [number, number] = [
    Math.floor(mid - spread * 0.75),
    Math.ceil(mid + spread * 0.75),
  ];

  return (
    <ChartFrame
      title="Shares outstanding"
      titleMetric="shareCountTrend"
      hint={`${shrinking ? "Down" : "Up"} ${Math.abs(totalChange).toFixed(1)}% from ${first.period} to ${last.period}${
        perYear === null ? "" : ` — ${perYear > 0 ? "+" : ""}${perYear.toFixed(2)}% a year`
      }, in millions.`}
      series={[{ key: "shares", label: "Shares (M)", color: "var(--series-1)" }]}
      table={
        <DataTable
          headers={["Period", "Shares (M)"]}
          rows={points.map((p) => [p.period, fmtShares(p.shares)])}
        />
      }
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 64, bottom: 4, left: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="period" {...axisProps} tickMargin={8} />
            <YAxis
              {...axisProps}
              width={56}
              domain={domain}
              allowDecimals={false}
              tickFormatter={(v: number) =>
                Math.round(v).toLocaleString("en-US")
              }
            />
            <Tooltip
              cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
              content={<ChartTooltip formatValue={(v) => `${fmtShares(v)}M`} />}
            />
            <Line
              type="monotone"
              dataKey="shares"
              name="Shares (M)"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--series-1)", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface-1)" }}
              isAnimationActive={false}
            />
            <ReferenceDot
              x={last.period}
              y={last.shares}
              r={4}
              fill="var(--series-1)"
              stroke="var(--surface-1)"
              strokeWidth={2}
              label={{
                value: `${fmtShares(last.shares)}M`,
                position: "right",
                fill: "var(--text-secondary)",
                fontSize: 11,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
