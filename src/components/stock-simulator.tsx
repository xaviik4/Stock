"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  cagr,
  projectStock,
  STOCK_SIM_DEFAULTS,
  type StockSimInputs,
} from "@/lib/projections";
import { compactMoney, money, percent, ratio } from "@/lib/format";
import { prefillSimulator } from "@/app/actions/analysis";
import {
  buttonClass,
  Card,
  inputClass,
  secondaryButtonClass,
  StatTile,
} from "@/components/ui";
import {
  axisProps,
  ChartFrame,
  ChartTooltip,
  DataTable,
  gridProps,
  type SeriesSpec,
} from "@/components/charts/chart-kit";

/**
 * Bear → base → bull is an ordered set, so it gets the ordinal blue ramp
 * (one hue, monotone lightness) rather than three unrelated categorical hues.
 */
const SERIES: SeriesSpec[] = [
  { key: "bear", label: "Bear · 0.65× multiple", color: "var(--ordinal-1)" },
  { key: "base", label: "Base multiple", color: "var(--ordinal-2)" },
  { key: "bull", label: "Bull · 1.35× multiple", color: "var(--ordinal-3)" },
];

/**
 * Every input carries what it is, where the number comes from, and what a
 * sensible value looks like. A forecasting tool that assumes you already know
 * what a terminal multiple is only works for people who don't need it.
 */
const FIELDS: {
  key: keyof StockSimInputs;
  label: string;
  what: string;
  typical: string;
  step?: string;
}[] = [
  {
    key: "currentFcf",
    label: "Free cash flow",
    what: "Cash left after running the business and paying for equipment — what's actually available to owners.",
    typical: "In millions. Load a ticker above to fill this from the last annual report.",
  },
  {
    key: "sharesOutstanding",
    label: "Shares outstanding",
    what: "How many slices the company is cut into. Cash flow per share is what you own.",
    typical: "In millions.",
  },
  {
    key: "netDebt",
    label: "Net debt",
    what: "Total debt minus cash. Debt-holders get paid before you, so it's subtracted from what the business is worth to shareholders.",
    typical: "Negative means the company holds more cash than debt — that's a good thing.",
  },
  {
    key: "fcfGrowthPct",
    label: "FCF growth per year",
    what: "How fast you think that cash flow compounds from here.",
    typical: "A mature business does 3–7%. Over 15% for a decade is rare and worth justifying.",
    step: "0.5",
  },
  {
    key: "shareChangePct",
    label: "Share count change per year",
    what: "Buybacks shrink the share count and lift your ownership; issuing shares dilutes it.",
    typical: "Negative for buybacks, e.g. −2. Positive for dilution.",
    step: "0.5",
  },
  {
    key: "terminalMultiple",
    label: "Exit multiple (price ÷ FCF)",
    what: "What you assume the market pays per dollar of cash flow at the end. This is usually the single biggest swing factor.",
    typical: "15–20 is average. Assuming today's multiple holds forever is the most common way to fool yourself.",
    step: "0.5",
  },
  {
    key: "years",
    label: "Years to model",
    what: "How far out to project. Further out means more compounding and more guesswork.",
    typical: "5–10 years.",
    step: "1",
  },
];

export function StockSimulator({ symbol }: { symbol?: string }) {
  const [inputs, setInputs] = useState<StockSimInputs>(STOCK_SIM_DEFAULTS);
  const [entryPrice, setEntryPrice] = useState(0);
  const [ticker, setTicker] = useState(symbol ?? "");
  const [loaded, setLoaded] = useState<{ symbol: string; name: string | null } | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const rows = useMemo(() => projectStock(inputs), [inputs]);
  const final = rows[rows.length - 1];
  const start = rows[0];

  const baseline = entryPrice > 0 ? entryPrice : start.base;
  const impliedCagr = cagr(baseline, final.base, final.year);

  const set = (key: keyof StockSimInputs) => (value: string) => {
    const parsed = Number.parseFloat(value);
    setInputs((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  const load = () => {
    if (!ticker.trim()) return;
    startLoading(async () => {
      setLoadError(null);
      const result = await prefillSimulator(ticker);
      if (!result.ok) {
        setLoadError(result.error);
        setLoaded(null);
        return;
      }
      setInputs((prev) => ({
        ...prev,
        currentFcf: result.currentFcf,
        sharesOutstanding: result.sharesOutstanding,
        netDebt: result.netDebt,
      }));
      if (result.price) setEntryPrice(result.price);
      setLoaded({ symbol: result.symbol, name: result.name });
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-sm font-semibold tracking-tight mb-1">
          What this tool does
        </h2>
        <p className="text-sm text-ink-2 leading-relaxed max-w-3xl">
          It answers one question: <em>if my assumptions are right, what is this stock
          worth later?</em> It grows the company&rsquo;s free cash flow forward, decides
          what the market will pay for that cash flow at the end, subtracts debt, and
          divides by the share count. Change any assumption and the chart moves.
        </p>
        <p className="text-sm text-ink-2 leading-relaxed max-w-3xl mt-3">
          The output is not a prediction — it&rsquo;s a way to see which assumption your
          thesis actually depends on. If a small change to the exit multiple swamps
          everything else, you&rsquo;re betting on sentiment, not the business.
        </p>

        <div className="mt-5 pt-4 border-t border-hairline">
          <label
            htmlFor="sim-ticker"
            className="block text-xs font-medium text-ink-2 mb-1.5"
          >
            Start from a real company
          </label>
          <div className="flex flex-wrap gap-2 items-start">
            <input
              id="sim-ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  load();
                }
              }}
              placeholder="e.g. AAPL"
              className={`${inputClass} w-40 uppercase`}
            />
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className={secondaryButtonClass}
            >
              {loading ? "Loading…" : "Load figures"}
            </button>
            {loaded ? (
              <p className="text-xs text-ink-2 self-center">
                Loaded {loaded.name ?? loaded.symbol} — cash flow, share count, and net
                debt below are its real figures.
              </p>
            ) : null}
          </div>
          {loadError ? (
            <p className="text-xs text-[var(--status-critical)] mt-2">{loadError}</p>
          ) : null}
          <p className="text-xs text-ink-muted mt-2">
            Optional. You can type figures in by hand instead — nothing here is saved.
          </p>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={`Base case, year ${final.year}`}
          value={money(final.base, true)}
          emphasis
          sub={`Cash flow per share ${money(final.fcfPerShare, true)}`}
        />
        <StatTile
          label="If the multiple compresses"
          value={money(final.bear, true)}
          sub={`At ${ratio(inputs.terminalMultiple * 0.65)}× instead of ${ratio(inputs.terminalMultiple)}×`}
        />
        <StatTile
          label="If it expands"
          value={money(final.bull, true)}
          sub={`At ${ratio(inputs.terminalMultiple * 1.35)}×`}
        />
        <StatTile
          label="Annual return, base case"
          value={impliedCagr === null ? "—" : percent(impliedCagr)}
          sub={
            entryPrice > 0
              ? `Buying at ${money(entryPrice, true)} today`
              : "Set an entry price below"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr] items-start">
        <div className="bg-surface border border-hairline rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {loaded ? `${loaded.symbol} assumptions` : "Assumptions"}
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Every field explains what it is and what a normal value looks like.
            </p>
          </div>

          {FIELDS.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`sim-${field.key}`}
                className="block text-xs font-medium text-ink-2 mb-1"
              >
                {field.label}
              </label>
              <p className="text-xs text-ink-muted mb-1.5 leading-relaxed">
                {field.what}
              </p>
              <input
                id={`sim-${field.key}`}
                type="number"
                inputMode="decimal"
                step={field.step ?? "1"}
                value={inputs[field.key]}
                onChange={(e) => set(field.key)(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                {field.typical}
              </p>
            </div>
          ))}

          <div className="pt-4 border-t border-hairline">
            <label
              htmlFor="sim-entry"
              className="block text-xs font-medium text-ink-2 mb-1"
            >
              Your entry price
            </label>
            <p className="text-xs text-ink-muted mb-1.5 leading-relaxed">
              What you&rsquo;d pay per share today. Sets the baseline for the return
              figure above.
            </p>
            <input
              id="sim-entry"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={entryPrice || ""}
              onChange={(e) => setEntryPrice(Number.parseFloat(e.target.value) || 0)}
              className={inputClass}
              placeholder="0.00"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setInputs(STOCK_SIM_DEFAULTS);
              setEntryPrice(0);
              setLoaded(null);
              setLoadError(null);
            }}
            className={`${buttonClass} w-full`}
          >
            Reset to defaults
          </button>
        </div>

        <div className="space-y-6">
          <ChartFrame
            title="What the share price would be"
            hint="All three lines assume the same business — they differ only in what the market pays for it at the end."
            series={SERIES}
            table={
              <DataTable
                headers={["Year", "FCF ($M)", "Shares (M)", "Bear", "Base", "Bull"]}
                rows={rows.map((r) => [
                  r.year === 0 ? "Now" : `Year ${r.year}`,
                  r.fcf.toLocaleString("en-US", { maximumFractionDigits: 0 }),
                  r.shares.toLocaleString("en-US", { maximumFractionDigits: 0 }),
                  money(r.bear, true),
                  money(r.base, true),
                  money(r.bull, true),
                ])}
              />
            }
          >
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 8, right: 56, bottom: 4, left: 4 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="year"
                    {...axisProps}
                    tickMargin={8}
                    tickFormatter={(v: number) => (v === 0 ? "Now" : `Y${v}`)}
                  />
                  <YAxis
                    {...axisProps}
                    width={64}
                    tickFormatter={(v: number) => `$${Math.round(v)}`}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
                    content={
                      <ChartTooltip
                        formatValue={(v) => money(v, true)}
                        labelPrefix="Year "
                      />
                    }
                  />
                  {SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>

          <Card>
            <h2 className="text-sm font-semibold tracking-tight mb-3">
              Reading this in plain English
            </h2>
            <ul className="text-sm text-ink-2 space-y-2.5 leading-relaxed">
              <li>
                Cash flow grows from {compactMoney(start.fcf * 1_000_000)} to{" "}
                {compactMoney(final.fcf * 1_000_000)} over {final.year} years at{" "}
                {percent(inputs.fcfGrowthPct)} a year.
              </li>
              <li>
                Share count moves from{" "}
                {start.shares.toLocaleString("en-US", { maximumFractionDigits: 0 })}M to{" "}
                {final.shares.toLocaleString("en-US", { maximumFractionDigits: 0 })}M, so
                each share owns{" "}
                {start.shares > final.shares ? "more" : "less"} of the business than it
                does today.
              </li>
              <li>
                <span className="text-ink font-medium">The multiple is the risk.</span>{" "}
                If the market re-rates from {ratio(inputs.terminalMultiple)}× down to{" "}
                {ratio(inputs.terminalMultiple * 0.65)}×, you lose{" "}
                {money(final.base - final.bear, true)} per share —{" "}
                {percent(((final.base - final.bear) / final.base) * 100, 0)} of the base
                case, with no change to the business at all.
              </li>
              {impliedCagr !== null ? (
                <li>
                  Buying at {money(baseline, true)} and selling at{" "}
                  {money(final.base, true)} in year {final.year} is{" "}
                  {percent(impliedCagr)} a year.{" "}
                  {impliedCagr < 7
                    ? "That's below what a broad index has historically returned — worth asking if the extra risk pays."
                    : "That clears a typical index return, if the assumptions hold."}
                </li>
              ) : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
