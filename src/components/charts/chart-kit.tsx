"use client";

import { useId, useState, type ReactNode } from "react";
import { MetricLabel } from "@/components/metric-label";
import type { MetricKey } from "@/lib/glossary";

/**
 * Shared chart chrome so every plot in the app reads as one system: hairline
 * grid, recessive axes, a legend whenever there are two or more series, and a
 * table-view twin so no value is reachable only by hovering.
 */

export type SeriesSpec = {
  key: string;
  label: string;
  color: string;
};

/** Recessive, solid hairlines — never dashed. */
export const gridProps = {
  stroke: "var(--grid)",
  strokeWidth: 1,
  vertical: false,
} as const;

export const axisProps = {
  stroke: "var(--axis)",
  strokeWidth: 1,
  tick: { fill: "var(--text-muted)", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "var(--axis)", strokeWidth: 1 },
} as const;

export function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  labelPrefix = "",
}: {
  active?: boolean;
  // Recharts' payload type is loose; we only read name/value/color.
  payload?: readonly { name?: string; value?: number; color?: string }[];
  label?: string | number;
  formatValue: (value: number) => string;
  labelPrefix?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-surface border border-hairline rounded-lg shadow-lg px-3 py-2 min-w-[168px]">
      <p className="text-xs text-ink-muted mb-1.5">
        {labelPrefix}
        {label}
      </p>
      <ul className="space-y-1">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: entry.color }}
                aria-hidden
              />
              {entry.name}
            </span>
            <span className="tnum font-medium text-ink">
              {formatValue(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Legend + table toggle. A legend is always present for two or more series,
 * so identity never rests on color alone; the table view is the WCAG-clean
 * equivalent of the plot.
 */
export function ChartFrame({
  title,
  titleMetric,
  hint,
  series,
  children,
  table,
}: {
  title: string;
  /** Attaches the glossary definition to the chart title. */
  titleMetric?: MetricKey;
  hint?: string;
  series: SeriesSpec[];
  children: ReactNode;
  table: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <figure className="bg-surface border border-hairline rounded-xl p-5 sm:p-6 m-0">
      <figcaption className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            {titleMetric ? (
              <MetricLabel metric={titleMetric}>{title}</MetricLabel>
            ) : (
              title
            )}
          </h2>
          {hint ? <p className="text-xs text-ink-muted mt-1">{hint}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="text-xs text-ink-2 hover:text-ink underline underline-offset-4 shrink-0"
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </figcaption>

      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-xs text-ink-2">
              <span
                className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                style={{ background: s.color }}
                aria-hidden
              />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div id={tableId}>
        {showTable ? (
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">{table}</div>
        ) : (
          children
        )}
      </div>
    </figure>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-surface">
        <tr className="text-xs text-ink-muted text-left">
          {headers.map((h, i) => (
            <th
              key={h}
              className={`py-2 pr-4 font-medium whitespace-nowrap ${
                i === 0 ? "" : "text-right"
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-hairline">
            {row.map((cell, j) => (
              <td
                key={j}
                className={`py-1.5 pr-4 whitespace-nowrap ${
                  j === 0 ? "text-ink-2" : "text-right tnum"
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
