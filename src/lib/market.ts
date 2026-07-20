import "server-only";
import YahooFinance from "yahoo-finance2";
import { alternateSpellings, describeType, isFund, isOperatingCompany, isValidTicker, normalizeTicker } from "@/lib/ticker";

/**
 * Live fundamentals from Yahoo Finance.
 *
 * This is the one part of the app that touches the network. Yahoo's endpoints
 * are unofficial and change without notice, so every field is optional and
 * every failure is returned as data rather than thrown — a missing PEG must
 * degrade to "—" in the UI, never blank the whole page.
 */

// The v4 client is a class; one instance per process is plenty.
const yf = new (YahooFinance as unknown as new (opts?: {
  suppressNotices?: string[];
  validation?: { logErrors?: boolean; logOptionsErrors?: boolean };
}) => YahooClient)({
  // We already handle empty statement modules; the survey notice is noise.
  suppressNotices: ["yahooSurvey"],
  // Yahoo's fund payloads fail the library's schema for some symbols (VTSAX,
  // FXAIX). We catch the throw per-call; this just keeps the stack traces out
  // of the server log, since they're expected and already handled.
  validation: { logErrors: false, logOptionsErrors: false },
});

type YahooClient = {
  quoteSummary(symbol: string, opts: { modules: string[] }): Promise<QuoteSummaryRaw & FundRaw>;
  fundamentalsTimeSeries(
    symbol: string,
    opts: { period1: string; type: string; module: string },
  ): Promise<FundamentalsRow[]>;
};

type QuoteSummaryRaw = {
  price?: {
    longName?: string;
    shortName?: string;
    quoteType?: string;
    currency?: string;
    regularMarketPrice?: number;
    regularMarketChangePercent?: number;
    regularMarketTime?: Date | string;
    marketState?: string;
    exchangeDataDelayedBy?: number;
  };
  summaryDetail?: {
    trailingPE?: number;
    forwardPE?: number;
    marketCap?: number;
    totalAssets?: number;
    yield?: number;
  };
  defaultKeyStatistics?: {
    enterpriseValue?: number;
    pegRatio?: number;
    sharesOutstanding?: number;
    enterpriseToEbitda?: number;
    mostRecentQuarter?: Date | string;
    lastFiscalYearEnd?: Date | string;
    beta3Year?: number;
  };
  financialData?: {
    freeCashflow?: number;
    totalDebt?: number;
    totalCash?: number;
    returnOnEquity?: number;
  };
};

type FundRaw = {
  fundProfile?: { categoryName?: string; family?: string };
  fundPerformance?: {
    trailingReturns?: {
      ytd?: number;
      oneYear?: number;
      threeYear?: number;
      fiveYear?: number;
      tenYear?: number;
    };
  };
  topHoldings?: {
    holdings?: { symbol?: string; holdingName?: string; holdingPercent?: number }[];
  };
};

type FundamentalsRow = Record<string, unknown> & { date?: Date | string };

export type SharePoint = { period: string; shares: number };

/** Fund-specific figures. Present for ETFs, often missing for mutual funds. */
export type FundInfo = {
  category: string | null;
  family: string | null;
  totalAssets: number | null;
  yieldPct: number | null;
  beta3Year: number | null;
  returns: { label: string; value: number }[];
  topHoldings: { symbol: string; name: string | null; weight: number }[];
};

export type LiveMetrics = {
  symbol: string;
  name: string | null;
  quoteType: string | null;
  currency: string | null;
  price: number | null;
  changePercent: number | null;

  /** Headline metrics. */
  evFcf: number | null;
  roic: number | null;
  /** Annualized change in share count, percent. Negative means buybacks. */
  shareCountTrend: number | null;

  /** Minor notes. */
  peRatio: number | null;
  pegRatio: number | null;

  /** Raw inputs, shown so the derived numbers can be checked. */
  enterpriseValue: number | null;
  freeCashFlow: number | null;
  sharesOutstanding: number | null;
  marketCap: number | null;
  totalDebt: number | null;
  totalCash: number | null;

  /** Shares outstanding by fiscal year, in millions, oldest first. */
  shareHistory: SharePoint[];

  /** Populated for funds; null for operating companies. */
  fund: FundInfo | null;

  /**
   * How current each layer actually is. These differ by a lot, and conflating
   * them is how a "live" dashboard quietly misleads you: the quote moves by the
   * second while the ratios built on filings are months old.
   */
  asOf: {
    /** When the quoted price was last struck. */
    quoteTime: string | null;
    /** REGULAR, CLOSED, PRE, POST — whether that price is moving right now. */
    marketState: string | null;
    /** Exchange delay on the quote, in minutes. 0 means real-time. */
    delayMinutes: number | null;
    /** End of the most recent reported quarter, behind EV/FCF and P/E. */
    mostRecentQuarter: string | null;
    /** Fiscal year end of the annual statements behind ROIC. */
    lastFiscalYearEnd: string | null;
  };

  /** True when ROIC came from statements rather than a vendor field. */
  roicIsDerived: boolean;
  fetchedAt: string;
  /** Non-fatal gaps worth telling the user about. */
  warnings: string[];
};

export type MetricsResult =
  | { ok: true; data: LiveMetrics }
  | { ok: false; symbol: string; error: string };

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n !== 0 ? n : typeof value === "number" && value === 0 ? 0 : null;
}

/** Yahoo sometimes returns `{ raw, fmt }` objects instead of bare numbers. */
function unwrap(value: unknown): number | null {
  if (value && typeof value === "object" && "raw" in value) {
    return finite((value as { raw: unknown }).raw);
  }
  return finite(value);
}

function toIso(date: Date | string | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fiscalYear(date: Date | string | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
}

/**
 * ROIC = NOPAT / invested capital.
 *
 * Yahoo publishes `investedCapital` directly but no ROIC, so NOPAT is derived
 * as EBIT × (1 − effective tax rate). Returns null rather than a guess when any
 * input is missing — a wrong ROIC would flip the buy signal.
 */
function computeRoic(row: FundamentalsRow): number | null {
  const ebit = unwrap(row.EBIT);
  const pretax = unwrap(row.pretaxIncome);
  const tax = unwrap(row.taxProvision);
  const investedCapital = unwrap(row.investedCapital);

  if (ebit === null || investedCapital === null || investedCapital <= 0) return null;

  let taxRate = 0.21; // US statutory fallback
  if (pretax !== null && tax !== null && pretax > 0) {
    const effective = tax / pretax;
    // Guard against loss years and one-off credits producing absurd rates.
    if (effective >= 0 && effective < 0.6) taxRate = effective;
  }

  const nopat = ebit * (1 - taxRate);
  return (nopat / investedCapital) * 100;
}

/** Annualized share-count change across the available history. */
function shareTrend(history: SharePoint[]): number | null {
  if (history.length < 2) return null;
  const first = history[0].shares;
  const last = history[history.length - 1].shares;
  const years = history.length - 1;
  if (first <= 0 || last <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

async function fetchLive(requested: string): Promise<MetricsResult> {
  const warnings: string[] = [];

  // Try the symbol as given, then any vendor-spelling variants (BRK.B → BRK-B).
  let summary: QuoteSummaryRaw | null = null;
  let symbol = requested;
  let lastError = "";

  for (const candidate of [requested, ...alternateSpellings(requested)]) {
    try {
      const result = await yf.quoteSummary(candidate, {
        modules: ["price", "summaryDetail", "defaultKeyStatistics", "financialData"],
      });

      // Yahoo doesn't always 404 an unknown symbol — for some (BF.B) it returns
      // 200 with an empty price block. An empty success is still a miss, so keep
      // trying the alternates rather than rendering a page full of nulls.
      const hasQuote =
        result.price?.regularMarketPrice !== undefined ||
        (result.price?.longName ?? result.price?.shortName) != null;
      if (!hasQuote) {
        lastError = `Quote not found for symbol: ${candidate}`;
        continue;
      }

      summary = result;
      symbol = candidate;
      if (candidate !== requested) {
        warnings.push(
          `Yahoo lists this security as ${candidate}; your broker exports it as ${requested}.`,
        );
      }
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!summary) {
    return {
      ok: false,
      symbol: requested,
      error: /not found/i.test(lastError)
        ? `No security found for "${requested}".`
        : `Yahoo Finance request failed: ${lastError}`,
    };
  }

  // Statement history is a separate, slower call and is allowed to fail on its
  // own — losing ROIC shouldn't cost us P/E.
  let rows: FundamentalsRow[] = [];
  try {
    rows = await yf.fundamentalsTimeSeries(symbol, {
      period1: "2018-01-01",
      type: "annual",
      module: "all",
    });
  } catch {
    warnings.push("Annual statements were unavailable, so ROIC and share history are missing.");
  }

  const shareHistory: SharePoint[] = [];
  for (const row of rows) {
    const period = fiscalYear(row.date);
    const shares =
      unwrap(row.ordinarySharesNumber) ??
      unwrap(row.shareIssued) ??
      unwrap(row.dilutedAverageShares);
    if (period && shares && shares > 0) {
      shareHistory.push({ period, shares: shares / 1_000_000 });
    }
  }
  shareHistory.sort((a, b) => a.period.localeCompare(b.period));

  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const roic = latest ? computeRoic(latest) : null;

  const enterpriseValue = unwrap(summary.defaultKeyStatistics?.enterpriseValue);
  const freeCashFlow = unwrap(summary.financialData?.freeCashflow);
  const evFcf =
    enterpriseValue !== null && freeCashFlow !== null && freeCashFlow > 0
      ? enterpriseValue / freeCashFlow
      : null;

  const quoteType = summary.price?.quoteType ?? null;

  // Funds get their own figures instead of blank company metrics. This call is
  // isolated because Yahoo's fund payload fails the library's schema for some
  // mutual funds (VTSAX, FXAIX) — losing the panel is fine, losing the page is not.
  let fund: FundInfo | null = null;
  if (isFund(quoteType)) {
    try {
      const raw = await yf.quoteSummary(symbol, {
        modules: ["fundProfile", "fundPerformance", "topHoldings"],
      });
      const trailing = raw.fundPerformance?.trailingReturns ?? {};
      const returns: { label: string; value: number }[] = [];
      for (const [label, raw] of [
        ["YTD", trailing.ytd],
        ["1-year", trailing.oneYear],
        ["3-year", trailing.threeYear],
        ["5-year", trailing.fiveYear],
        ["10-year", trailing.tenYear],
      ] as [string, number | undefined][]) {
        const value = unwrap(raw);
        // Yahoo returns these as fractions; the UI wants percent.
        if (value !== null) returns.push({ label, value: value * 100 });
      }

      fund = {
        category: raw.fundProfile?.categoryName ?? null,
        family: raw.fundProfile?.family ?? null,
        totalAssets: unwrap(summary.summaryDetail?.totalAssets),
        yieldPct: (() => {
          const y = unwrap(summary.summaryDetail?.yield);
          return y === null ? null : y * 100;
        })(),
        beta3Year: unwrap(summary.defaultKeyStatistics?.beta3Year),
        returns,
        topHoldings: (raw.topHoldings?.holdings ?? [])
          .map((h) => ({
            symbol: String(h.symbol ?? "").toUpperCase(),
            name: h.holdingName ?? null,
            weight: (unwrap(h.holdingPercent) ?? 0) * 100,
          }))
          .filter((h) => h.symbol && h.weight > 0)
          .slice(0, 10),
      };
    } catch {
      // Yahoo returns no usable fund detail for this symbol. Price and any
      // ratios from the core call still render.
      fund = null;
    }
  }

  if (quoteType && !isOperatingCompany(quoteType)) {
    warnings.push(
      `${symbol} is ${describeType(quoteType) === "index" ? "an index" : `a ${describeType(quoteType)}`}, not an operating company — EV/FCF and ROIC don't apply to it.`,
    );
  } else {
    if (evFcf === null) warnings.push("Enterprise value or free cash flow was unavailable, so EV/FCF is missing.");
    if (roic === null) warnings.push("ROIC could not be derived from the latest annual statements.");
  }

  return {
    ok: true,
    data: {
      // The symbol Yahoo actually matched, which may differ from the request.
      symbol,
      name: summary.price?.longName ?? summary.price?.shortName ?? null,
      quoteType,
      currency: summary.price?.currency ?? null,
      price: unwrap(summary.price?.regularMarketPrice),
      changePercent: unwrap(summary.price?.regularMarketChangePercent),

      evFcf,
      roic,
      shareCountTrend: shareTrend(shareHistory),

      peRatio: unwrap(summary.summaryDetail?.trailingPE),
      pegRatio: unwrap(summary.defaultKeyStatistics?.pegRatio),

      enterpriseValue,
      freeCashFlow,
      sharesOutstanding: unwrap(summary.defaultKeyStatistics?.sharesOutstanding),
      marketCap: unwrap(summary.summaryDetail?.marketCap),
      totalDebt: unwrap(summary.financialData?.totalDebt),
      totalCash: unwrap(summary.financialData?.totalCash),

      shareHistory,
      fund,
      asOf: {
        quoteTime: toIso(summary.price?.regularMarketTime),
        marketState: summary.price?.marketState ?? null,
        delayMinutes: unwrap(summary.price?.exchangeDataDelayedBy),
        mostRecentQuarter: toIso(summary.defaultKeyStatistics?.mostRecentQuarter),
        lastFiscalYearEnd: toIso(summary.defaultKeyStatistics?.lastFiscalYearEnd),
      },
      roicIsDerived: roic !== null,
      fetchedAt: new Date().toISOString(),
      warnings,
    },
  };
}

/**
 * Process-local TTL cache.
 *
 * Yahoo rate-limits aggressively and the analyzer list fetches every tracked
 * ticker at once, so repeated renders must not mean repeated requests. This is
 * a single-user local app, so an in-memory map is the right size of solution.
 */
const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; result: MetricsResult }>();
const inflight = new Map<string, Promise<MetricsResult>>();

export async function getMetrics(
  rawSymbol: string,
  opts: { force?: boolean } = {},
): Promise<MetricsResult> {
  const symbol = normalizeTicker(rawSymbol);
  if (!isValidTicker(symbol)) {
    return { ok: false, symbol, error: `"${rawSymbol}" doesn't look like a ticker symbol.` };
  }

  if (!opts.force) {
    const hit = cache.get(symbol);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
    // Collapse concurrent requests for the same ticker into one fetch.
    const pending = inflight.get(symbol);
    if (pending) return pending;
  }

  const promise = fetchLive(symbol)
    .then((result) => {
      // Don't cache failures for long — a transient network blip shouldn't
      // pin an error in place for 15 minutes.
      if (result.ok) cache.set(symbol, { at: Date.now(), result });
      else cache.delete(symbol);
      return result;
    })
    .finally(() => inflight.delete(symbol));

  inflight.set(symbol, promise);
  return promise;
}

/** Fetch many tickers at once, in parallel, tolerating individual failures. */
export async function getManyMetrics(symbols: string[]): Promise<MetricsResult[]> {
  return Promise.all(symbols.map((s) => getMetrics(s)));
}

export function cachedAt(symbol: string): number | null {
  return cache.get(symbol.trim().toUpperCase())?.at ?? null;
}
