"use client";

import { useState } from "react";
import { GLOSSARY, GROUP_LABELS, type GlossaryEntry, type MetricKey } from "@/lib/glossary";
import { TARGETS, type Tone } from "@/lib/ratings";

const GROUPS: GlossaryEntry["group"][] = ["core", "minor", "qualitative"];

const TONE_DOT: Record<Tone, string> = {
  good: "bg-good",
  warning: "bg-warning",
  serious: "bg-serious",
  critical: "bg-critical",
  neutral: "bg-[var(--axis)]",
};

/**
 * The bands, spelled out. Mirrors `rate()` in ratings.ts — the colored pill on
 * a metric means nothing unless you can see the scale it came from.
 */
const SCALES: Partial<Record<MetricKey, { tone: Tone; label: string; range: string }[]>> = {
  evFcf: [
    { tone: "good", label: "Cheap", range: "< 15" },
    { tone: "good", label: "Fair", range: "15–20" },
    { tone: "warning", label: "Rich", range: "20–30" },
    { tone: "serious", label: "Expensive", range: "30–45" },
    { tone: "critical", label: "Very expensive", range: "> 45" },
  ],
  roic: [
    { tone: "critical", label: "Poor", range: "< 5%" },
    { tone: "serious", label: "Weak", range: "5–10%" },
    { tone: "warning", label: "Fair", range: "10–15%" },
    { tone: "good", label: "Strong", range: "15–25%" },
    { tone: "good", label: "Excellent", range: "> 25%" },
  ],
  shareCountTrend: [
    { tone: "good", label: "Buying back", range: "< −0.5%/yr" },
    { tone: "neutral", label: "Flat", range: "−0.5 to +0.5%" },
    { tone: "warning", label: "Slight dilution", range: "+0.5 to +2%" },
    { tone: "critical", label: "Diluting", range: "> +2%/yr" },
  ],
  pe: [
    { tone: "good", label: "Low", range: "< 15" },
    { tone: "good", label: "Moderate", range: "15–25" },
    { tone: "warning", label: "High", range: "25–40" },
    { tone: "serious", label: "Very high", range: "> 40" },
  ],
  peg: [
    { tone: "good", label: "Good value", range: "< 1.0" },
    { tone: "good", label: "Reasonable", range: "1.0–1.5" },
    { tone: "warning", label: "Pricey", range: "1.5–2.5" },
    { tone: "serious", label: "Expensive", range: "> 2.5" },
  ],
};

/**
 * The full definition list. Tooltips cover the metric you're looking at; this
 * covers "what are all of these?" without hunting for each one — and gives the
 * definitions a keyboard-reachable home that doesn't depend on hover at all.
 */
export function GlossarySidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink border border-hairline rounded-lg px-3 py-1.5 hover:bg-surface-2 transition-colors"
      >
        <span aria-hidden>?</span>
        Glossary
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Close glossary"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Metric glossary"
            className="relative w-full max-w-sm h-full bg-surface border-l border-hairline overflow-y-auto"
          >
            <div className="sticky top-0 bg-surface border-b border-hairline px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Glossary</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close glossary"
                className="w-7 h-7 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-5 space-y-6">
              {GROUPS.map((group) => {
                const entries = GLOSSARY.filter((e) => e.group === group);
                return (
                  <section key={group}>
                    <h3 className="text-xs text-ink-muted uppercase tracking-wide mb-3">
                      {GROUP_LABELS[group]}
                    </h3>
                    <dl className="space-y-4">
                      {entries.map((entry) => (
                        <div key={entry.key}>
                          <dt className="text-sm font-medium text-ink">{entry.term}</dt>
                          <dd className="text-sm text-ink-2 mt-0.5 leading-relaxed">
                            {entry.definition}
                          </dd>
                          {TARGETS[entry.key] ? (
                            <dd className="text-xs text-ink-muted mt-1.5 leading-relaxed">
                              <span className="font-medium text-ink-2">
                                What good looks like:{" "}
                              </span>
                              {TARGETS[entry.key]}
                            </dd>
                          ) : null}
                          {SCALES[entry.key] ? (
                            <dd className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {SCALES[entry.key]!.map((step) => (
                                <span
                                  key={step.label}
                                  className="inline-flex items-center gap-1.5 text-xs text-ink-2"
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${TONE_DOT[step.tone]}`}
                                    aria-hidden
                                  />
                                  {step.label}
                                  <span className="text-ink-muted tnum">{step.range}</span>
                                </span>
                              ))}
                            </dd>
                          ) : null}
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              })}

              <p className="text-xs text-ink-muted leading-relaxed border-t border-hairline pt-4">
                Core metrics and minor notes are pulled live from Yahoo Finance. The
                research fields are yours, saved locally.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
