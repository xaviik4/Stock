import type { MetricKey } from "@/lib/glossary";

/**
 * "Is this number good?" — the bands behind every colored reading in the UI.
 *
 * Tones come from the reserved status palette and are always rendered with a
 * text label beside them, never color alone. Bands are deliberately coarse:
 * these are rules of thumb for screening, not valuations. A ticker that reads
 * "Expensive" is not a sell, it's a prompt to look closer.
 */

export type Tone = "good" | "warning" | "serious" | "critical" | "neutral";

export type Rating = {
  tone: Tone;
  /** Short verdict shown beside the number. */
  label: string;
  /** One line explaining what the number implies. */
  note: string;
};

type Band = { max: number; tone: Tone; label: string; note: string };

/** Bands are evaluated in order; the first whose `max` the value is under wins. */
const BANDS: Partial<Record<MetricKey, { lowerIsBetter: boolean; bands: Band[] }>> = {
  evFcf: {
    lowerIsBetter: true,
    bands: [
      { max: 15, tone: "good", label: "Cheap", note: "Under 15× — you're paying little for each dollar of cash flow." },
      { max: 20, tone: "good", label: "Fair", note: "Inside the 20× target. Reasonable for a quality business." },
      { max: 30, tone: "warning", label: "Rich", note: "Above target. The price already assumes growth." },
      { max: 45, tone: "serious", label: "Expensive", note: "You need years of strong growth just to break even on the multiple." },
      { max: Infinity, tone: "critical", label: "Very expensive", note: "Priced for perfection — a small miss re-rates this hard." },
    ],
  },
  roic: {
    lowerIsBetter: false,
    bands: [
      { max: 5, tone: "critical", label: "Poor", note: "Barely covers the cost of capital. Growth here destroys value." },
      { max: 10, tone: "serious", label: "Weak", note: "Below the cost of capital for most businesses." },
      { max: 15, tone: "warning", label: "Fair", note: "Acceptable, but under the 15% floor for a compounder." },
      { max: 25, tone: "good", label: "Strong", note: "Clears the floor. Reinvested profits earn a good return." },
      { max: Infinity, tone: "good", label: "Excellent", note: "Exceptional capital efficiency — usually a sign of a real moat." },
    ],
  },
  shareCountTrend: {
    lowerIsBetter: true,
    bands: [
      { max: -2, tone: "good", label: "Big buyback", note: "Share count shrinking fast — your slice grows every year." },
      { max: -0.5, tone: "good", label: "Buying back", note: "Steady buybacks. Management returning cash to owners." },
      { max: 0.5, tone: "neutral", label: "Flat", note: "Share count roughly stable. Neither helping nor hurting." },
      { max: 2, tone: "warning", label: "Slight dilution", note: "Modest dilution, often stock compensation." },
      { max: Infinity, tone: "critical", label: "Diluting", note: "Your ownership shrinks each year. Earnings per share fight a headwind." },
    ],
  },
  pe: {
    lowerIsBetter: true,
    bands: [
      { max: 15, tone: "good", label: "Low", note: "Cheap on earnings — check whether earnings are durable." },
      { max: 25, tone: "good", label: "Moderate", note: "Around the long-run market average." },
      { max: 40, tone: "warning", label: "High", note: "Above market. Growth needs to justify it." },
      { max: Infinity, tone: "serious", label: "Very high", note: "Either fast growth is expected, or earnings are temporarily depressed." },
    ],
  },
  peg: {
    lowerIsBetter: true,
    bands: [
      { max: 1, tone: "good", label: "Good value", note: "Growth costs less than 1× its P/E — the classic bargain zone." },
      { max: 1.5, tone: "good", label: "Reasonable", note: "Fairly priced against expected growth." },
      { max: 2.5, tone: "warning", label: "Pricey", note: "Paying up for growth that hasn't happened yet." },
      { max: Infinity, tone: "serious", label: "Expensive", note: "Expensive even after accounting for growth estimates." },
    ],
  },
};

/** What "good" looks like, for the glossary. */
export const TARGETS: Partial<Record<MetricKey, string>> = {
  evFcf: "Lower is better. Under 20× hits the target; under 15× is cheap.",
  roic: "Higher is better. 15% is the floor; over 25% is exceptional.",
  shareCountTrend: "Negative is better — it means buybacks. Above +2%/yr is real dilution.",
  pe: "Lower is better, but only comparable within an industry. 15–25 is typical.",
  peg: "Under 1.0 is the classic bargain; over 2.5 is expensive even for growth.",
  debtStructure: "You're looking for long maturities, fixed rates, and interest covered many times over by cash flow.",
  industryMoat: "You're looking for a reason margins survive competition — switching costs, scale, network effects, or brand.",
  managementAlignment: "You're looking for meaningful insider ownership and pay tied to per-share value, not headline revenue.",
};

const UNKNOWN: Rating = {
  tone: "neutral",
  label: "No data",
  note: "Not reported for this security.",
};

export function rate(metric: MetricKey, value: number | null): Rating {
  if (value === null || !Number.isFinite(value)) return UNKNOWN;

  const config = BANDS[metric];
  if (!config) return UNKNOWN;

  // A negative EV/FCF or P/E means negative cash flow or earnings — the band
  // logic would read that as "cheap", which is exactly backwards.
  if (config.lowerIsBetter && metric !== "shareCountTrend" && value <= 0) {
    return {
      tone: "critical",
      label: "Negative",
      note:
        metric === "evFcf"
          ? "Free cash flow is negative — the business is burning cash."
          : "Earnings are negative, so this ratio doesn't mean anything.",
    };
  }

  for (const band of config.bands) {
    if (value < band.max) return { tone: band.tone, label: band.label, note: band.note };
  }
  return UNKNOWN;
}

/** Whether a written-up qualitative field has been filled in. */
export function rateNote(value: string | null): Rating {
  return value && value.trim()
    ? { tone: "good", label: "Documented", note: "You've written up your view on this." }
    : {
        tone: "neutral",
        label: "Not written up",
        note: "No notes yet — this is the part a data feed can't fill in.",
      };
}
