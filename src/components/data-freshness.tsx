import type { LiveMetrics } from "@/lib/market";

/**
 * States how current each layer of the data really is.
 *
 * "Live" is doing a lot of work in most finance UIs. The quote genuinely moves
 * intraday; the ratios built on filings are months old and only change four
 * times a year. Showing them side by side without saying so invites the reader
 * to trust a stale EV/FCF as much as the price.
 */
export function DataFreshness({ live }: { live: LiveMetrics }) {
  // Fiscal period ends are date-only values that Yahoo stamps at UTC midnight.
  // Rendering them in local time shifts them a day earlier west of UTC, so a
  // quarter ending Mar 28 displays as Mar 27. Format these in UTC; the quote
  // timestamp below is a real instant and stays local.
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "unknown";

  const fmtDateTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "unknown";

  const state = live.asOf.marketState;
  const isOpen = state === "REGULAR";
  const delay = live.asOf.delayMinutes;

  const quoteLine = isOpen
    ? `Market open · ${delay ? `${delay}-minute delayed` : "real-time"} quote`
    : `Market ${state === "PRE" ? "pre-open" : state === "POST" ? "after hours" : "closed"} · last traded ${fmtDateTime(live.asOf.quoteTime)}`;

  const rows: { label: string; value: string; covers: string }[] = [
    { label: "Share price", value: quoteLine, covers: "Price, daily change" },
    {
      label: "Latest quarter",
      value: fmtDate(live.asOf.mostRecentQuarter),
      covers: "EV/FCF, P/E, PEG, market cap, debt, cash",
    },
    {
      label: "Latest annual report",
      value: fmtDate(live.asOf.lastFiscalYearEnd),
      covers: "ROIC, share count history",
    },
  ];

  return (
    <details className="bg-surface border border-hairline rounded-xl px-5 sm:px-6 py-4 group">
      <summary className="text-xs text-ink-2 cursor-pointer list-none flex items-center gap-2">
        <span className="text-ink-muted group-open:rotate-90 transition-transform">›</span>
        How current is this data?
      </summary>

      <p className="text-xs text-ink-2 mt-3 mb-4 leading-relaxed">
        Only the share price moves during the day. Everything derived from
        financial statements updates when the company files — quarterly at best.
      </p>

      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2 font-medium">{row.label}</dt>
              <dd className="text-ink tnum text-right">{row.value}</dd>
            </div>
            <p className="text-ink-muted mt-0.5">{row.covers}</p>
          </div>
        ))}
      </dl>
    </details>
  );
}
