import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMetrics } from "@/lib/market";
import { describeType, isOperatingCompany, isValidTicker, normalizeTicker } from "@/lib/ticker";
import { compactMoney, money, percent, ratio, shortDate } from "@/lib/format";
import { evaluate, THRESHOLDS } from "@/lib/signals";
import { rate } from "@/lib/ratings";
import { AnalysisForm } from "@/components/analysis-form";
import { ShareCountChart } from "@/components/charts/share-count-chart";
import { MetricLabel } from "@/components/metric-label";
import { GlossarySidebar } from "@/components/glossary-sidebar";
import { RefreshButton } from "@/components/refresh-button";
import { DataFreshness } from "@/components/data-freshness";
import { FundPanel } from "@/components/fund-panel";
import { Card, PageHeader, StatTile, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TickerPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = normalizeTicker(decodeURIComponent(raw));

  // A string that can't be a ticker gets an explanation, not a bare 404 — the
  // most likely cause is a typo, and a dead end doesn't help you fix it.
  if (!isValidTicker(symbol)) {
    return (
      <div className="space-y-6">
        <Link
          href="/analyzer"
          className="text-xs text-ink-2 hover:text-ink underline underline-offset-4"
        >
          ← All tickers
        </Link>
        <PageHeader title="That doesn't look like a ticker" />
        <Card>
          <p className="text-sm text-ink-2 leading-relaxed">
            <span className="font-medium text-ink">{symbol.slice(0, 40)}</span> isn&rsquo;t
            a symbol we can look up. Ticker symbols are up to 15 characters and may
            contain letters, digits, dots, and hyphens.
          </p>
          <p className="text-sm text-ink-2 leading-relaxed mt-3">
            All of these work: <code className="text-ink">AAPL</code>,{" "}
            <code className="text-ink">BRK.B</code> (class shares),{" "}
            <code className="text-ink">VTSAX</code> (mutual funds),{" "}
            <code className="text-ink">^GSPC</code> (indices),{" "}
            <code className="text-ink">SHOP.TO</code> (non-US listings).
          </p>
          <Link
            href="/analyzer"
            className="inline-block mt-5 text-sm underline underline-offset-4"
          >
            Back to the analyzer
          </Link>
        </Card>
      </div>
    );
  }

  const [analysis, holdings, metrics] = await Promise.all([
    prisma.stockAnalysis.findUnique({ where: { symbol } }),
    prisma.fidelityInvestment.findMany({ where: { symbol } }),
    getMetrics(symbol),
  ]);

  const live = metrics.ok ? metrics.data : null;

  const signal = evaluate({ evFcf: live?.evFcf ?? null, roic: live?.roic ?? null });

  const heldValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const heldQuantity = holdings.reduce((sum, h) => sum + h.quantity, 0);

  const signalTone =
    signal.signal === "buy"
      ? "good"
      : signal.signal === "pass"
        ? "critical"
        : signal.signal === "watch"
          ? "warning"
          : "neutral";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/analyzer"
          className="text-xs text-ink-2 hover:text-ink underline underline-offset-4"
        >
          ← All tickers
        </Link>
        <GlossarySidebar />
      </div>

      <PageHeader
        title={symbol}
        lede={
          live?.name
            ? `${live.name}${live.price !== null ? ` · ${money(live.price, true)}` : ""}${
                live.changePercent !== null
                  ? ` (${live.changePercent > 0 ? "+" : ""}${live.changePercent.toFixed(2)}% today)`
                  : ""
              }`
            : undefined
        }
        actions={<RefreshButton symbol={symbol} />}
      />

      {!metrics.ok ? (
        <div className="bg-surface border border-hairline rounded-xl p-5">
          <p className="text-sm font-medium text-[var(--status-critical)]">
            Live data unavailable
          </p>
          <p className="text-sm text-ink-2 mt-1">{metrics.error}</p>
          <p className="text-sm text-ink-2 mt-2">
            Your saved notes below are unaffected.
          </p>
        </div>
      ) : !isOperatingCompany(live!.quoteType) ? (
        /* Funds, indices, and pairs have no business behind them — showing the
           company scaffolding full of dashes would imply the data is missing
           rather than inapplicable. */
        <>
          <div className="bg-surface border border-hairline rounded-xl p-5">
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink">{symbol}</span> is{" "}
              {describeType(live!.quoteType) === "index" ? "an" : "a"}{" "}
              {describeType(live!.quoteType)}, not an operating company. EV/FCF, ROIC,
              and share-count trend describe a business, so they don&rsquo;t apply
              here.
            </p>
          </div>

          {live!.fund ? (
            <FundPanel symbol={symbol} fund={live!.fund} />
          ) : (
            <Card>
              <h2 className="text-sm font-semibold tracking-tight mb-1">
                Quote only
              </h2>
              <p className="text-sm text-ink-2 leading-relaxed">
                Yahoo doesn&rsquo;t publish profile or holdings detail for {symbol}
                {" — "}
                that&rsquo;s common for mutual funds. The price above is current;
                everything else is unavailable.
              </p>
              {live!.peRatio !== null ? (
                <p className="text-sm text-ink-2 mt-3">
                  Reported <MetricLabel metric="pe">P/E</MetricLabel> of the underlying
                  basket: <span className="tnum font-medium">{ratio(live!.peRatio)}</span>
                </p>
              ) : null}
            </Card>
          )}

          <DataFreshness live={live!} />
        </>
      ) : (
        <>
          <div className="bg-surface border border-hairline rounded-xl p-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusPill tone={signalTone}>{signal.label}</StatusPill>
            <p className="text-sm text-ink-2">{signal.reason}</p>
          </div>

          {/* The hierarchy is the point: these get the space and the type size. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile
              label="EV/FCF"
              metric="evFcf"
              value={ratio(live!.evFcf)}
              emphasis
              rating={rate("evFcf", live!.evFcf)}
              sub={`Target ≤ ${THRESHOLDS.evFcfTarget}`}
            />
            <StatTile
              label="ROIC"
              metric="roic"
              value={percent(live!.roic)}
              emphasis
              rating={rate("roic", live!.roic)}
              sub={`Floor ≥ ${THRESHOLDS.roicFloor}%`}
            />
            <StatTile
              label="Share count trend"
              metric="shareCountTrend"
              value={
                live!.shareCountTrend === null
                  ? "—"
                  : `${live!.shareCountTrend > 0 ? "+" : ""}${percent(live!.shareCountTrend)}`
              }
              emphasis
              rating={rate("shareCountTrend", live!.shareCountTrend)}
            />
          </div>

          {live!.warnings.length > 0 ? (
            <div className="border border-dashed border-hairline rounded-xl px-5 py-4">
              <ul className="text-xs text-ink-2 space-y-1.5">
                {live!.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <DataFreshness live={live!} />

          {live!.shareHistory.length >= 2 ? (
            <ShareCountChart symbol={symbol} points={live!.shareHistory} />
          ) : null}
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
        <AnalysisForm
          values={{
            symbol,
            debtStructure: analysis?.debtStructure ?? null,
            industryMoat: analysis?.industryMoat ?? null,
            managementAlignment: analysis?.managementAlignment ?? null,
          }}
        />

        <div className="space-y-6">
          {live && isOperatingCompany(live.quoteType) ? (
            <Card>
              <h2 className="text-sm font-semibold tracking-tight mb-1">
                Underlying figures
              </h2>
              <p className="text-xs text-ink-muted mb-4">
                The raw inputs behind the ratios above, so the derived numbers can be
                checked.
              </p>
              <dl className="space-y-2.5 text-sm">
                {(
                  [
                    ["Market cap", live.marketCap === null ? "—" : compactMoney(live.marketCap)],
                    ["Enterprise value", live.enterpriseValue === null ? "—" : compactMoney(live.enterpriseValue)],
                    ["Free cash flow", live.freeCashFlow === null ? "—" : compactMoney(live.freeCashFlow)],
                    ["Total debt", live.totalDebt === null ? "—" : compactMoney(live.totalDebt)],
                    ["Total cash", live.totalCash === null ? "—" : compactMoney(live.totalCash)],
                    [
                      "Shares outstanding",
                      live.sharesOutstanding === null
                        ? "—"
                        : `${(live.sharesOutstanding / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 0 })}M`,
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-ink-2">{label}</dt>
                    <dd className="tnum font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              {/* P/E and PEG stay demoted — present, but below the fold of attention. */}
              <div className="mt-5 pt-4 border-t border-hairline">
                <p className="text-xs text-ink-muted uppercase tracking-wide mb-2.5">
                  Minor notes
                </p>
                <dl className="space-y-3 text-sm">
                  {(
                    [
                      ["pe", "P/E", ratio(live.peRatio), rate("pe", live.peRatio)],
                      ["peg", "PEG", ratio(live.pegRatio, 2), rate("peg", live.pegRatio)],
                    ] as const
                  ).map(([key, label, value, rating]) => (
                    <div key={key}>
                      <div className="flex justify-between gap-4">
                        <dt className="text-ink-2">
                          <MetricLabel metric={key}>{label}</MetricLabel>
                        </dt>
                        <dd className="tnum">{value}</dd>
                      </div>
                      {rating.tone !== "neutral" ? (
                        <dd className="mt-1">
                          <StatusPill tone={rating.tone}>{rating.label}</StatusPill>
                        </dd>
                      ) : null}
                    </div>
                  ))}
                </dl>
              </div>

              <p className="text-xs text-ink-muted mt-4 pt-4 border-t border-hairline">
                Yahoo Finance, fetched {shortDate(live.fetchedAt)}. ROIC is derived as
                NOPAT ÷ invested capital; Yahoo does not publish it directly.
              </p>
            </Card>
          ) : null}

          {holdings.length > 0 ? (
            <Card>
              <h2 className="text-sm font-semibold tracking-tight mb-1">
                Your position
              </h2>
              <p className="text-xs text-ink-muted mb-4">
                {heldQuantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}{" "}
                shares · {money(heldValue)}
              </p>
              <ul className="divide-y divide-[var(--border)]">
                {holdings.map((h) => (
                  <li key={h.id} className="flex justify-between gap-4 py-2.5 text-sm">
                    <span className="text-ink-2">{h.accountType}</span>
                    <span className="tnum">{money(h.currentValue)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
