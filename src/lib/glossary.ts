/**
 * Metric definitions, verbatim. One source of truth so the sidebar, the
 * tooltips, and any future export can never drift apart.
 */

export type MetricKey =
  | "pe"
  | "peg"
  | "evFcf"
  | "roic"
  | "shareCountTrend"
  | "debtStructure"
  | "industryMoat"
  | "managementAlignment";

export type GlossaryEntry = {
  key: MetricKey;
  term: string;
  definition: string;
  /** Headline metrics vs. the demoted ratios vs. the written-up judgements. */
  group: "core" | "minor" | "qualitative";
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    key: "evFcf",
    term: "EV/FCF",
    definition: "Enterprise value divided by free cash flow",
    group: "core",
  },
  {
    key: "roic",
    term: "ROIC",
    definition: "Return on invested capital, measuring capital efficiency",
    group: "core",
  },
  {
    key: "shareCountTrend",
    term: "Share Count Trend",
    definition:
      "Historical tracking of outstanding shares to check for dilution or buybacks",
    group: "core",
  },
  {
    key: "pe",
    term: "P/E",
    definition: "Share price divided by earnings per share",
    group: "minor",
  },
  {
    key: "peg",
    term: "PEG",
    definition: "P/E ratio divided by expected growth rate",
    group: "minor",
  },
  {
    key: "debtStructure",
    term: "Debt Structure",
    definition: "Breakdown of debt maturity and interest",
    group: "qualitative",
  },
  {
    key: "industryMoat",
    term: "Industry Moat",
    definition: "The competitive advantage protecting margins",
    group: "qualitative",
  },
  {
    key: "managementAlignment",
    term: "Management Alignment",
    definition:
      "How well executive interests match long-term shareholders",
    group: "qualitative",
  },
];

const BY_KEY = new Map(GLOSSARY.map((entry) => [entry.key, entry]));

export function define(key: MetricKey): GlossaryEntry {
  const entry = BY_KEY.get(key);
  if (!entry) throw new Error(`No glossary entry for "${key}"`);
  return entry;
}

export const GROUP_LABELS: Record<GlossaryEntry["group"], string> = {
  core: "Core metrics",
  minor: "Minor notes",
  qualitative: "Your research",
};
