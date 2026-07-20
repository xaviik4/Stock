import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { money, percent, shares as fmtShares, shortDate } from "@/lib/format";
import { CsvUpload } from "@/components/csv-upload";
import { Card, CardTitle, EmptyState, PageHeader, StatTile } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const [holdings, latestSnapshot, snapshotCount] = await Promise.all([
    prisma.fidelityInvestment.findMany({ orderBy: { currentValue: "desc" } }),
    prisma.portfolioSnapshot.findFirst({ orderBy: { uploadDate: "desc" } }),
    prisma.portfolioSnapshot.count(),
  ]);

  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  const byAccount = new Map<string, { value: number; count: number }>();
  for (const h of holdings) {
    const entry = byAccount.get(h.accountType) ?? { value: 0, count: 0 };
    entry.value += h.currentValue;
    entry.count += 1;
    byAccount.set(h.accountType, entry);
  }
  const accounts = [...byAccount.entries()].sort((a, b) => b[1].value - a[1].value);

  const bySymbol = new Map<string, number>();
  for (const h of holdings) {
    bySymbol.set(h.symbol, (bySymbol.get(h.symbol) ?? 0) + h.currentValue);
  }
  const largest = [...bySymbol.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolio"
        lede="Upload a Fidelity positions export to refresh your holdings. The file is parsed in the browser and written straight to the local database."
      />

      {holdings.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total value"
            value={money(totalValue)}
            emphasis
            sub={
              latestSnapshot
                ? `As of ${shortDate(latestSnapshot.uploadDate)}`
                : undefined
            }
          />
          <StatTile label="Positions" value={String(holdings.length)} />
          <StatTile label="Accounts" value={String(accounts.length)} />
          <StatTile
            label="Largest holding"
            value={largest ? largest[0] : "—"}
            sub={
              largest && totalValue > 0
                ? `${money(largest[1])} · ${percent((largest[1] / totalValue) * 100)}`
                : undefined
            }
          />
        </div>
      ) : null}

      <Card>
        <CardTitle
          hint={
            snapshotCount > 0
              ? `${snapshotCount} upload${snapshotCount === 1 ? "" : "s"} archived so far.`
              : undefined
          }
        >
          Import holdings
        </CardTitle>
        <CsvUpload />
      </Card>

      {accounts.length > 0 ? (
        <Card>
          <CardTitle hint="Share of total portfolio value by account type.">
            Allocation by account
          </CardTitle>
          <ul className="space-y-3">
            {accounts.map(([name, entry]) => {
              const share = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
              return (
                <li key={name}>
                  <div className="flex items-baseline justify-between gap-4 mb-1.5">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-sm text-ink-2 tnum">
                      {money(entry.value)}{" "}
                      <span className="text-ink-muted">· {percent(share)}</span>
                    </span>
                  </div>
                  {/* One series, so one color for every bar — length carries the value. */}
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-series-1"
                      style={{ width: `${Math.max(share, 0.5)}%` }}
                    />
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    {entry.count} position{entry.count === 1 ? "" : "s"}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card className="!p-0 overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 sm:pt-6">
          <CardTitle hint="Click a ticker to open its research page.">Holdings</CardTitle>
        </div>

        {holdings.length === 0 ? (
          <div className="px-5 sm:px-6 pb-6">
            <EmptyState title="No holdings yet">
              Drop a Fidelity CSV above and your positions will appear here.
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted border-b border-hairline">
                  <th className="px-5 sm:px-6 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium text-right">Quantity</th>
                  <th className="px-4 py-2.5 font-medium text-right">Value</th>
                  <th className="px-5 sm:px-6 py-2.5 font-medium text-right">Weight</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-hairline last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-5 sm:px-6 py-2.5">
                      <Link
                        href={`/analyzer/${h.symbol}`}
                        className="font-medium hover:underline underline-offset-4"
                      >
                        {h.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{h.accountType}</td>
                    <td className="px-4 py-2.5 text-right tnum text-ink-2">
                      {fmtShares(h.quantity)}
                    </td>
                    <td className="px-4 py-2.5 text-right tnum">
                      {money(h.currentValue)}
                    </td>
                    <td className="px-5 sm:px-6 py-2.5 text-right tnum text-ink-2">
                      {percent(totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
