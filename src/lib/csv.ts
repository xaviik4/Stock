/**
 * Fidelity CSV ingestion.
 *
 * Fidelity's "Portfolio_Positions" export is not a stable contract: header
 * capitalization drifts ("Current Value" vs "Current value"), columns get
 * added, non-breaking spaces sneak in, and the file ends with a block of
 * disclaimer prose that parses as garbage rows. Everything here is written to
 * survive that, and to fail loudly with a readable message when it can't.
 *
 * Pure functions only — no DB, no React. That keeps the mapping testable and
 * lets the same code run on the client (preview) and the server (write).
 */

export type ParsedHolding = {
  accountType: string;
  accountLabel: string;
  symbol: string;
  quantity: number;
  currentValue: number;
};

export type ParseReport = {
  holdings: ParsedHolding[];
  skipped: { reason: string; count: number }[];
  totalValue: number;
  headerMap: Record<FieldName, string>;
};

export type FieldName = "account" | "symbol" | "quantity" | "currentValue";

/**
 * Accepted header spellings, in priority order. Matching is done on a
 * normalized form, so only meaningfully different wordings belong here —
 * not case or spacing variants.
 */
const HEADER_ALIASES: Record<FieldName, string[]> = {
  account: ["accountname", "account", "accountnumber", "accountnamenumber"],
  symbol: ["symbol", "ticker", "securitysymbol"],
  quantity: ["quantity", "shares", "qty", "quantityheld"],
  currentValue: ["currentvalue", "value", "marketvalue", "currentmarketvalue"],
};

/** Lowercase, strip everything that isn't a letter or digit. */
function normalizeHeader(header: string): string {
  return header
    .replace(/ /g, " ") // non-breaking space → space
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/**
 * Case-insensitive, punctuation-insensitive header resolution.
 *
 * Returns the *original* header string for each field so the caller can index
 * back into PapaParse's row objects, plus the list of fields it could not find.
 */
export function mapHeaders(headers: string[]): {
  map: Partial<Record<FieldName, string>>;
  missing: FieldName[];
} {
  const normalized = headers.map((h) => ({ original: h, key: normalizeHeader(h) }));
  const map: Partial<Record<FieldName, string>> = {};

  for (const field of Object.keys(HEADER_ALIASES) as FieldName[]) {
    for (const alias of HEADER_ALIASES[field]) {
      const exact = normalized.find((h) => h.key === alias);
      if (exact) {
        map[field] = exact.original;
        break;
      }
    }
    // Nothing matched outright — fall back to a prefix match so a future
    // "Current Value ($)" or "Quantity (shares)" still lands.
    if (!map[field]) {
      for (const alias of HEADER_ALIASES[field]) {
        const partial = normalized.find(
          (h) => h.key.startsWith(alias) || alias.startsWith(h.key),
        );
        if (partial && partial.key.length > 2) {
          map[field] = partial.original;
          break;
        }
      }
    }
  }

  const missing = (Object.keys(HEADER_ALIASES) as FieldName[]).filter((f) => !map[f]);
  return { map, missing };
}

/**
 * "$1,234.56" → 1234.56, "(45.00)" → -45, "--" → null.
 */
export function parseNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;

  const cleaned = raw.replace(/ /g, " ").trim();
  if (!cleaned || /^(--|-|n\/?a)$/i.test(cleaned)) return null;

  const negative = /^\(.*\)$/.test(cleaned);
  const digits = cleaned.replace(/[()]/g, "").replace(/[$,%\s]/g, "");
  if (!digits || !/^-?\d*\.?\d+$/.test(digits)) return null;

  const value = Number.parseFloat(digits);
  if (!Number.isFinite(value)) return null;
  return negative ? -Math.abs(value) : value;
}

/**
 * Collapse Fidelity's account labels into the three buckets that actually
 * change how the money is taxed. Anything unrecognized keeps its own label so
 * a new account type shows up in the UI instead of silently becoming
 * "Brokerage".
 */
export function classifyAccount(rawLabel: string): string {
  const label = rawLabel.replace(/ /g, " ").trim();
  const key = label.toLowerCase();

  if (key.includes("roth")) return "Roth IRA";
  if (key.includes("rollover")) return "Rollover IRA";
  if (/\bsep\b/.test(key)) return "SEP IRA";
  if (key.includes("ira") || key.includes("traditional")) return "Traditional IRA";
  if (key.includes("401")) return "401(k)";
  if (key.includes("hsa")) return "HSA";
  if (key.includes("529")) return "529";
  if (
    key.includes("individual") ||
    key.includes("brokerage") ||
    key.includes("joint") ||
    key.includes("taxable")
  ) {
    return "Brokerage";
  }
  return label || "Unclassified";
}

/** Rows Fidelity includes that are not positions. */
function isNonPosition(symbol: string): string | null {
  const s = symbol.trim().toUpperCase();
  if (!s) return "Blank symbol";
  if (s.startsWith("PENDING")) return "Pending activity";
  // The disclaimer block at the end of the file lands in the symbol column.
  if (s.length > 12 || /\s/.test(s)) return "Disclaimer / footer text";
  return null;
}

/**
 * Turn PapaParse output into holdings. Rows that can't be read are counted and
 * reported rather than dropped silently — a partial import you don't know about
 * is worse than a failed one.
 */
export function buildHoldings(
  rows: Record<string, unknown>[],
  headers: string[],
): ParseReport {
  const { map, missing } = mapHeaders(headers);
  if (missing.length > 0) {
    throw new Error(
      `Could not find ${missing.join(", ")} in the CSV headers. ` +
        `Found: ${headers.filter(Boolean).join(", ")}`,
    );
  }
  const resolved = map as Record<FieldName, string>;

  const skipCounts = new Map<string, number>();
  const skip = (reason: string) =>
    skipCounts.set(reason, (skipCounts.get(reason) ?? 0) + 1);

  // Keyed by account+symbol so a security held twice in one account (Fidelity
  // sometimes splits core positions) sums instead of colliding on upsert.
  const merged = new Map<string, ParsedHolding>();

  for (const row of rows) {
    const rawSymbol = String(row[resolved.symbol] ?? "").trim();
    const nonPosition = isNonPosition(rawSymbol);
    if (nonPosition) {
      skip(nonPosition);
      continue;
    }

    const currentValue = parseNumber(row[resolved.currentValue]);
    if (currentValue === null) {
      skip("Unreadable current value");
      continue;
    }

    const accountLabel = String(row[resolved.account] ?? "").trim();
    const accountType = classifyAccount(accountLabel);
    // Core/money-market positions report no share count; treat them as 1:1.
    const quantity = parseNumber(row[resolved.quantity]) ?? currentValue;
    const symbol = rawSymbol.toUpperCase();

    const key = `${accountType}::${symbol}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.currentValue += currentValue;
    } else {
      merged.set(key, {
        accountType,
        accountLabel,
        symbol,
        quantity,
        currentValue,
      });
    }
  }

  const holdings = [...merged.values()].sort((a, b) => b.currentValue - a.currentValue);

  return {
    holdings,
    skipped: [...skipCounts.entries()].map(([reason, count]) => ({ reason, count })),
    totalValue: holdings.reduce((sum, h) => sum + h.currentValue, 0),
    headerMap: resolved,
  };
}
