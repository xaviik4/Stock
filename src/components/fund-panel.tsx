import type { FundInfo } from "@/lib/market";
import { compactMoney, percent } from "@/lib/format";
import { Card } from "@/components/ui";

/**
 * What a fund page shows instead of company metrics.
 *
 * EV/FCF and ROIC are properties of a business. A fund doesn't have a business —
 * it has a basket, a fee, and a track record. Showing those is more useful than
 * showing six dashes where a company's figures would go.
 */
export function FundPanel({ symbol, fund }: { symbol: string; fund: FundInfo }) {
  const facts: { label: string; value: string }[] = [];
  if (fund.category) facts.push({ label: "Category", value: fund.category });
  if (fund.family) facts.push({ label: "Fund family", value: fund.family });
  if (fund.totalAssets !== null)
    facts.push({ label: "Total assets", value: compactMoney(fund.totalAssets) });
  if (fund.yieldPct !== null)
    facts.push({ label: "Yield", value: percent(fund.yieldPct, 2) });
  if (fund.beta3Year !== null)
    facts.push({ label: "Beta (3-year)", value: fund.beta3Year.toFixed(2) });

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <Card>
        <h2 className="text-sm font-semibold tracking-tight mb-1">Fund profile</h2>
        {/* The explicit spacer is required: this JSX transform drops the
            leading space of a text node that follows an expression. */}
        <p className="text-xs text-ink-muted mb-4">
          {symbol}{" "}
          holds a basket of securities, so it&rsquo;s judged on cost, spread, and
          track record rather than on business quality.
        </p>

        {facts.length > 0 ? (
          <dl className="space-y-2.5 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-4">
                <dt className="text-ink-2">{f.label}</dt>
                <dd className="font-medium text-right">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-ink-2">Yahoo returned no profile detail for this fund.</p>
        )}

        {fund.returns.length > 0 ? (
          <div className="mt-5 pt-4 border-t border-hairline">
            <p className="text-xs text-ink-muted uppercase tracking-wide mb-2.5">
              Trailing returns
            </p>
            <dl className="space-y-2 text-sm">
              {fund.returns.map((r) => (
                <div key={r.label} className="flex justify-between gap-4">
                  <dt className="text-ink-2">{r.label}</dt>
                  <dd
                    className={`tnum font-medium ${
                      r.value >= 0
                        ? "text-[var(--success-text)]"
                        : "text-[var(--status-critical)]"
                    }`}
                  >
                    {r.value > 0 ? "+" : ""}
                    {percent(r.value)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-ink-muted mt-3 leading-relaxed">
              Annualized past performance, net of fees. Past returns don&rsquo;t predict
              future ones.
            </p>
          </div>
        ) : null}
      </Card>

      {fund.topHoldings.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold tracking-tight mb-1">Top holdings</h2>
          <p className="text-xs text-ink-muted mb-4">
            What you actually own through {symbol}. Research these individually if you
            want company-level metrics.
          </p>
          <ul className="space-y-2.5">
            {fund.topHoldings.map((h) => (
              <li key={h.symbol}>
                <div className="flex items-baseline justify-between gap-4 mb-1">
                  <span className="text-sm font-medium">{h.symbol}</span>
                  <span className="text-sm text-ink-2 tnum">{percent(h.weight, 2)}</span>
                </div>
                {/* One series, so one color — length carries the value. */}
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-series-1"
                    style={{
                      width: `${Math.min(100, (h.weight / fund.topHoldings[0].weight) * 100)}%`,
                    }}
                  />
                </div>
                {h.name ? (
                  <p className="text-xs text-ink-muted mt-1 truncate">{h.name}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
