/**
 * The buy/pass rule. Deliberately blunt: two cash-flow gates, everything else
 * is a note. Thresholds live here so the UI and any future export agree.
 */

export const THRESHOLDS = {
  /** EV/FCF at or below this is "cheap enough". */
  evFcfTarget: 20,
  /** ROIC at or above this is "compounds well". */
  roicFloor: 15,
  /** Share count shrinking by more than this is a real buyback. */
  buybackPct: -1,
  /** Share count growing by more than this is meaningful dilution. */
  dilutionPct: 2,
};

export type Signal = "buy" | "watch" | "pass" | "incomplete";

export type SignalResult = {
  signal: Signal;
  label: string;
  reason: string;
};

type Metrics = {
  evFcf: number | null;
  roic: number | null;
};

export function evaluate({ evFcf, roic }: Metrics): SignalResult {
  if (evFcf === null && roic === null) {
    return {
      signal: "incomplete",
      label: "No signal",
      reason:
        "Neither EV/FCF nor ROIC is available for this security, so there's nothing to score.",
    };
  }
  if (evFcf === null || roic === null) {
    const missing = evFcf === null ? "EV/FCF" : "ROIC";
    return {
      signal: "incomplete",
      label: "No signal",
      reason: `${missing} isn't reported for this security, so the signal needs both halves.`,
    };
  }

  const cheap = evFcf > 0 && evFcf <= THRESHOLDS.evFcfTarget;
  const efficient = roic >= THRESHOLDS.roicFloor;

  if (cheap && efficient) {
    return {
      signal: "buy",
      label: "Potential buy",
      reason: `EV/FCF ${evFcf.toFixed(1)} is at or under ${THRESHOLDS.evFcfTarget} and ROIC ${roic.toFixed(1)}% clears ${THRESHOLDS.roicFloor}%.`,
    };
  }
  if (efficient) {
    return {
      signal: "watch",
      label: "Quality, rich",
      reason: `ROIC ${roic.toFixed(1)}% is strong, but EV/FCF ${evFcf.toFixed(1)} is above the ${THRESHOLDS.evFcfTarget} target.`,
    };
  }
  if (cheap) {
    return {
      signal: "watch",
      label: "Cheap, low return",
      reason: `EV/FCF ${evFcf.toFixed(1)} is attractive, but ROIC ${roic.toFixed(1)}% is under the ${THRESHOLDS.roicFloor}% floor.`,
    };
  }
  return {
    signal: "pass",
    label: "Pass",
    reason: `EV/FCF ${evFcf.toFixed(1)} and ROIC ${roic.toFixed(1)}% both miss the thresholds.`,
  };
}
