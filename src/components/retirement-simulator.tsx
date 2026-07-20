"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  projectRetirement,
  RETIREMENT_DEFAULTS,
  type RetirementInputs,
} from "@/lib/projections";
import { compactMoney, money, percent } from "@/lib/format";
import { Field, inputClass, StatTile } from "@/components/ui";
import {
  axisProps,
  ChartFrame,
  ChartTooltip,
  DataTable,
  gridProps,
  type SeriesSpec,
} from "@/components/charts/chart-kit";

// Fixed slot order: the reader learns these three colors once and they never move.
const SERIES: SeriesSpec[] = [
  { key: "principal", label: "Your principal", color: "var(--series-1)" },
  { key: "employerMatch", label: "Employer match", color: "var(--series-2)" },
  { key: "growth", label: "Market growth", color: "var(--series-3)" },
];

const FIELDS: {
  key: keyof RetirementInputs;
  label: string;
  hint?: string;
  step?: string;
  suffix?: "%" | "$";
}[] = [
  { key: "currentAge", label: "Current age" },
  { key: "retirementAge", label: "Retirement age" },
  { key: "currentPortfolioValue", label: "Starting balance", suffix: "$" },
  { key: "annualSalary", label: "Annual salary", suffix: "$" },
  {
    key: "contributionPct",
    label: "Your contribution",
    suffix: "%",
    hint: "Percent of salary you defer",
    step: "0.5",
  },
  {
    key: "matchLimitPct",
    label: "Company match limit",
    suffix: "%",
    hint: "Matched dollar-for-dollar up to this",
    step: "0.5",
  },
  { key: "expectedReturnPct", label: "Expected return (CAGR)", suffix: "%", step: "0.1" },
  { key: "salaryGrowthPct", label: "Annual raise", suffix: "%", step: "0.1" },
];

export function RetirementSimulator({
  portfolioValue,
  hasPortfolio,
}: {
  portfolioValue: number;
  hasPortfolio: boolean;
}) {
  const [inputs, setInputs] = useState<RetirementInputs>({
    ...RETIREMENT_DEFAULTS,
    currentPortfolioValue: portfolioValue,
  });

  const rows = useMemo(() => projectRetirement(inputs), [inputs]);
  const final = rows[rows.length - 1];
  const contributedTotal = final.principal + final.employerMatch;
  const matchShare =
    final.total > 0 ? (final.employerMatch / final.total) * 100 : 0;

  const set = (key: keyof RetirementInputs) => (value: string) => {
    const parsed = Number.parseFloat(value);
    setInputs((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={`Balance at ${final.age}`}
          value={money(final.total)}
          emphasis
          sub={`${rows.length - 1} years of compounding`}
        />
        <StatTile label="Your principal" value={money(final.principal)} />
        <StatTile
          label="Employer match"
          value={money(final.employerMatch)}
          sub={`${percent(matchShare)} of the final balance`}
        />
        <StatTile
          label="Market growth"
          value={money(final.growth)}
          sub={`On ${money(contributedTotal)} contributed`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] items-start">
        <div className="bg-surface border border-hairline rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Assumptions</h2>
            <p className="text-xs text-ink-muted mt-1">
              {hasPortfolio
                ? "Starting balance is pre-filled from your last CSV upload."
                : "Upload a Fidelity CSV to pre-fill the starting balance."}
            </p>
          </div>

          {FIELDS.map((field) => (
            <Field key={field.key} label={field.label} hint={field.hint}>
              <div className="relative">
                {field.suffix === "$" ? (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                    $
                  </span>
                ) : null}
                <input
                  type="number"
                  inputMode="decimal"
                  step={field.step ?? "1"}
                  value={inputs[field.key]}
                  onChange={(e) => set(field.key)(e.target.value)}
                  className={`${inputClass} ${field.suffix === "$" ? "pl-7" : ""} ${
                    field.suffix === "%" ? "pr-8" : ""
                  }`}
                />
                {field.suffix === "%" ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                    %
                  </span>
                ) : null}
              </div>
            </Field>
          ))}

          {inputs.contributionPct < inputs.matchLimitPct ? (
            <p className="text-xs text-[var(--status-critical)] leading-relaxed">
              You&rsquo;re contributing under the match limit — raising your deferral to{" "}
              {percent(inputs.matchLimitPct, 0)} captures{" "}
              {money(
                inputs.annualSalary *
                  ((inputs.matchLimitPct - inputs.contributionPct) / 100),
              )}{" "}
              more per year in free money.
            </p>
          ) : null}
        </div>

        <ChartFrame
          title="Projected balance by source"
          hint="Bands stack to the total. Employer match is compounded separately from your own principal."
          series={SERIES}
          table={
            <DataTable
              headers={["Age", "Your principal", "Employer match", "Growth", "Total"]}
              rows={rows.map((r) => [
                r.age,
                money(r.principal),
                money(r.employerMatch),
                money(r.growth),
                money(r.total),
              ])}
            />
          }
        >
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="age"
                  {...axisProps}
                  tickMargin={8}
                  label={{
                    value: "Age",
                    position: "insideBottom",
                    offset: -2,
                    fill: "var(--text-muted)",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  {...axisProps}
                  width={64}
                  tickFormatter={(v: number) => compactMoney(v)}
                />
                <Tooltip
                  cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
                  content={
                    <ChartTooltip formatValue={(v) => money(v)} labelPrefix="Age " />
                  }
                />
                {SERIES.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stackId="total"
                    fill={s.color}
                    fillOpacity={0.9}
                    // A 2px surface-colored edge separates the bands instead of a border.
                    stroke="var(--surface-1)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      </div>
    </div>
  );
}
