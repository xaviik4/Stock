"use client";

import { useActionState } from "react";
import { saveAnalysis, type SaveResult } from "@/app/actions/analysis";
import { buttonClass, StatusPill, textareaClass } from "@/components/ui";
import { MetricLabel } from "@/components/metric-label";
import type { MetricKey } from "@/lib/glossary";
import { rateNote, TARGETS } from "@/lib/ratings";

export type AnalysisValues = {
  symbol: string;
  debtStructure: string | null;
  industryMoat: string | null;
  managementAlignment: string | null;
};

const FIELDS: {
  name: keyof Omit<AnalysisValues, "symbol">;
  metric: MetricKey;
  label: string;
  placeholder: string;
}[] = [
  {
    name: "debtStructure",
    metric: "debtStructure",
    label: "Debt structure",
    placeholder:
      "e.g. $12B notes, weighted maturity 2031, all fixed at 3.4%. Interest covered 14× by FCF. No covenants that bite before 2029.",
  },
  {
    name: "industryMoat",
    metric: "industryMoat",
    label: "Industry moat",
    placeholder:
      "e.g. Switching costs — customers embed the API in their billing stack. Two-year average integration. Net revenue retention 118%.",
  },
  {
    name: "managementAlignment",
    metric: "managementAlignment",
    label: "Management alignment",
    placeholder:
      "e.g. CEO owns 4.1% outright, no options grants since 2022. Comp tied to FCF/share, not revenue. Bought back stock below 15× FCF in 2023.",
  },
];

/**
 * The only writable surface left. Everything numeric now comes from Yahoo on
 * each render, so this form is purely the judgements a feed can't supply.
 */
export function AnalysisForm({ values }: { values: AnalysisValues }) {
  const [state, formAction, pending] = useActionState<SaveResult | null, FormData>(
    saveAnalysis,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="symbol" value={values.symbol} />

      <div className="bg-surface border border-hairline rounded-xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold tracking-tight">Qualitative research</h2>
        <p className="text-xs text-ink-muted mt-1 mb-5">
          The part no data feed gives you. Saved to the local database, per ticker.
        </p>

        <div className="space-y-5">
          {FIELDS.map((field) => {
            const reading = rateNote(values[field.name]);
            return (
              <div key={field.name}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-xs font-medium text-ink-2">
                    <MetricLabel metric={field.metric}>{field.label}</MetricLabel>
                  </span>
                  <StatusPill tone={reading.tone}>{reading.label}</StatusPill>
                </div>
                <textarea
                  name={field.name}
                  aria-label={field.label}
                  defaultValue={values[field.name] ?? ""}
                  placeholder={field.placeholder}
                  className={textareaClass}
                />
                <p className="text-xs text-ink-muted mt-1">{TARGETS[field.metric]}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save notes"}
        </button>
        {state ? (
          <span
            role="status"
            className={`text-sm ${
              state.ok ? "text-[var(--success-text)]" : "text-[var(--status-critical)]"
            }`}
          >
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
