import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getManyMetrics } from "@/lib/market";
import { money, percent, ratio } from "@/lib/format";
import { evaluate, THRESHOLDS } from "@/lib/signals";
import { rate } from "@/lib/ratings";
import {
  buttonClass,
  Card,
  EmptyState,
  inputClass,
  PageHeader,
  StatusPill,
} from "@/components/ui";
import { MetricLabel } from "@/components/metric-label";
import { GlossarySidebar } from "@/components/glossary-sidebar";
import { startAnalysis } from "@/app/actions/analysis";

export const dynamic = "force-dynamic";

export default async function AnalyzerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; symbol?: string }>;
}) {
  const { error, symbol: errorSymbol } = await searchParams;

  const [tracked, holdings] = await Promise.all([
    prisma.stockAnalysis.findMany({ orderBy: { symbol: "asc" } }),
    prisma.fidelityInvestment.findMany(),
  ]);

  // One parallel fan-out, de-duplicated and TTL-cached inside getMetrics.
  const metrics = await getManyMetrics(tracked.map((t) => t.symbol));

  const ownedValue = new Map<string, number>();
  for (const h of holdings) {
    ownedValue.set(h.symbol, (ownedValue.get(h.symbol) ?? 0) + h.currentValue);
  }

  const rows = tracked.map((t, i) => {
    const live = metrics[i];
    const data = live.ok ? live.data : null;
    return {
      symbol: t.symbol,
      name: data?.name ?? null,
      error: live.ok ? null : live.error,
      evFcf: data?.evFcf ?? null,
      roic: data?.roic ?? null,
      shareCountTrend: data?.shareCountTrend ?? null,
      peRatio: data?.peRatio ?? null,
      pegRatio: data?.pegRatio ?? null,
      signal: evaluate({ evFcf: data?.evFcf ?? null, roic: data?.roic ?? null }),
      evFcfRating: rate("evFcf", data?.evFcf ?? null),
      roicRating: rate("roic", data?.roic ?? null),
      trend: rate("shareCountTrend", data?.shareCountTrend ?? null),
      owned: ownedValue.get(t.symbol) ?? 0,
      hasNotes: Boolean(t.debtStructure || t.industryMoat || t.managementAlignment),
    };
  });

  const unresearched = [...ownedValue.keys()]
    .filter((s) => !tracked.some((t) => t.symbol === s))
    .sort();

  const buys = rows.filter((r) => r.signal.signal === "buy").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stock analyzer"
        lede={`Metrics are pulled live from Yahoo Finance. A ticker flags as a potential buy when EV/FCF is at or under ${THRESHOLDS.evFcfTarget} and ROIC clears ${THRESHOLDS.roicFloor}%.`}
        actions={
          <div className="flex items-start gap-2">
            <GlossarySidebar />
            <form action={startAnalysis} className="flex gap-2 items-start">
              <div>
                <input
                  name="symbol"
                  required
                  maxLength={12}
                  placeholder="Add ticker"
                  aria-label="Ticker symbol"
                  className={`${inputClass} w-36 uppercase`}
                />
                {error === "invalid-ticker" ? (
                  <p className="text-xs text-[var(--status-critical)] mt-1">
                    That isn&rsquo;t a valid ticker.
                  </p>
                ) : null}
                {error === "not-found" ? (
                  <p className="text-xs text-[var(--status-critical)] mt-1">
                    Yahoo has no security called {errorSymbol}.
                  </p>
                ) : null}
              </div>
              <button type="submit" className={buttonClass}>
                Add
              </button>
            </form>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No tickers tracked yet">
          Add one above, or open a holding from your{" "}
          <Link href="/" className="underline underline-offset-4">
            portfolio
          </Link>
          .
        </EmptyState>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-hairline flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">
              {rows.length} ticker{rows.length === 1 ? "" : "s"} tracked
            </h2>
            {buys > 0 ? (
              <StatusPill tone="good">{buys} meeting both thresholds</StatusPill>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted border-b border-hairline">
                  <th className="px-5 sm:px-6 py-2.5 font-medium">Symbol</th>
                  {/* The two metrics that decide the call. */}
                  <th className="px-4 py-2.5 font-medium text-right text-ink-2">
                    <MetricLabel metric="evFcf" />
                  </th>
                  <th className="px-4 py-2.5 font-medium text-right text-ink-2">
                    <MetricLabel metric="roic" />
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    <MetricLabel metric="shareCountTrend">Share count</MetricLabel>
                  </th>
                  <th className="px-4 py-2.5 font-medium">Signal</th>
                  {/* Deliberately last and quiet. */}
                  <th className="px-5 sm:px-6 py-2.5 font-medium">Minor notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.symbol}
                    className="border-b border-hairline last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-5 sm:px-6 py-3">
                      <Link
                        href={`/analyzer/${r.symbol}`}
                        className="font-medium hover:underline underline-offset-4"
                      >
                        {r.symbol}
                      </Link>
                      <div className="text-xs text-ink-muted mt-0.5 max-w-[200px] truncate">
                        {r.owned > 0 ? `${money(r.owned)} held` : (r.name ?? "")}
                      </div>
                    </td>

                    {r.error ? (
                      <td colSpan={5} className="px-4 py-3 text-xs text-[var(--status-critical)]">
                        {r.error}
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right">
                          <span className="text-base font-semibold tnum">
                            {ratio(r.evFcf)}
                          </span>
                          <div className="mt-0.5 flex justify-end">
                            <StatusPill tone={r.evFcfRating.tone}>
                              {r.evFcfRating.label}
                            </StatusPill>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-base font-semibold tnum">
                            {percent(r.roic)}
                          </span>
                          <div className="mt-0.5 flex justify-end">
                            <StatusPill tone={r.roicRating.tone}>
                              {r.roicRating.label}
                            </StatusPill>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={r.trend.tone}>{r.trend.label}</StatusPill>
                          {r.shareCountTrend !== null ? (
                            <div className="text-xs text-ink-muted mt-0.5 tnum">
                              {r.shareCountTrend > 0 ? "+" : ""}
                              {percent(r.shareCountTrend)}/yr
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill
                            tone={
                              r.signal.signal === "buy"
                                ? "good"
                                : r.signal.signal === "pass"
                                  ? "critical"
                                  : r.signal.signal === "watch"
                                    ? "warning"
                                    : "neutral"
                            }
                          >
                            {r.signal.label}
                          </StatusPill>
                          {r.hasNotes ? (
                            <div className="text-xs text-ink-muted mt-0.5">
                              Notes on file
                            </div>
                          ) : null}
                        </td>
                        <td className="px-5 sm:px-6 py-3 text-xs text-ink-muted tnum whitespace-nowrap">
                          <MetricLabel metric="pe">P/E</MetricLabel> {ratio(r.peRatio)} ·{" "}
                          <MetricLabel metric="peg">PEG</MetricLabel>{" "}
                          {ratio(r.pegRatio, 2)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="px-5 sm:px-6 py-3 border-t border-hairline text-xs text-ink-muted">
            Live figures cached for 15 minutes. Open a ticker to refresh it.
          </p>
        </Card>
      )}

      {unresearched.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold tracking-tight mb-1">
            Held but not tracked
          </h2>
          <p className="text-xs text-ink-muted mb-4">
            These are in your portfolio with no analysis page yet.
          </p>
          <ul className="flex flex-wrap gap-2">
            {unresearched.map((symbol) => (
              <li key={symbol}>
                <Link
                  href={`/analyzer/${symbol}`}
                  className="inline-block px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline text-sm hover:bg-page transition-colors"
                >
                  {symbol}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
