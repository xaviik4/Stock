/**
 * Ticker validation, shared by the route, the actions, and the market client.
 *
 * Deliberately permissive about *shape* — Yahoo is the authority on whether a
 * symbol exists, and this only rejects strings that clearly can't be one. Being
 * too strict here is how legitimate securities get a 404 instead of an answer:
 *
 *   BRK.B    class shares use a dot
 *   BRK-B    …or a hyphen, depending on the vendor
 *   VTSAX    5-letter mutual funds
 *   0700.HK  non-US listings
 *   ^GSPC    indices are prefixed with a caret
 *   ES=F     futures use an equals sign
 *   BTC-USD  currency and crypto pairs
 */
export const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.\-=]{0,14}$|^\^[A-Z0-9.\-]{1,14}$/;

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidTicker(raw: string): boolean {
  return TICKER_PATTERN.test(normalizeTicker(raw));
}

/**
 * Alternate spellings to try when Yahoo doesn't recognize a symbol.
 *
 * Brokerages disagree with Yahoo on class shares: Fidelity exports `BRK.B`,
 * Yahoo wants `BRK-B`. Without this, every class-share holding in a portfolio
 * dead-ends on "no security found" when you click through from the holdings
 * table. Only a single trailing letter is treated as a class suffix — `SHOP.TO`
 * and `0700.HK` are exchange suffixes and must be left alone.
 */
export function alternateSpellings(symbol: string): string[] {
  const alts: string[] = [];
  const classShare = /^([A-Z0-9]+)[.\-]([A-Z])$/.exec(symbol);
  if (classShare) {
    const [, base, cls] = classShare;
    for (const candidate of [`${base}-${cls}`, `${base}.${cls}`]) {
      if (candidate !== symbol) alts.push(candidate);
    }
  }
  return alts;
}

/** Human labels for Yahoo's `quoteType`, which is raw enum text. */
const TYPE_LABELS: Record<string, string> = {
  EQUITY: "stock",
  ETF: "ETF",
  MUTUALFUND: "mutual fund",
  INDEX: "index",
  CURRENCY: "currency pair",
  CRYPTOCURRENCY: "cryptocurrency",
  FUTURE: "futures contract",
  OPTION: "option",
};

export function describeType(quoteType: string | null): string {
  if (!quoteType) return "security";
  return TYPE_LABELS[quoteType] ?? quoteType.toLowerCase();
}

/** Whether company-level metrics (EV/FCF, ROIC) are meaningful at all. */
export function isOperatingCompany(quoteType: string | null): boolean {
  return quoteType === "EQUITY";
}

/** Whether the fund panel (category, returns, holdings) applies. */
export function isFund(quoteType: string | null): boolean {
  return quoteType === "ETF" || quoteType === "MUTUALFUND";
}
