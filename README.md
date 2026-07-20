# Portfolio Desk

A tool for tracking a Fidelity portfolio, researching individual equities on
cash-flow metrics, and projecting retirement.

**Where your data goes.** Your portfolio — balances, holdings, account types — never
leaves this machine; it lives in a local SQLite file, and the CSV is parsed in the
browser. The one exception is the Stock Analyzer: it queries Yahoo Finance, so the
**ticker symbols you research are sent to Yahoo**. Your position sizes are not. If
you'd rather nothing left the machine at all, the analyzer is the only part to
avoid — everything else still works offline.

## Running it

```bash
npm install
npx prisma migrate dev   # creates dev.db from prisma/schema.prisma
npm run dev              # http://localhost:3000
```

`DATABASE_URL` in `.env` points at `file:./dev.db` in the project root. Delete that
file to start over, or run `npm run db:reset`.

## What's here

**Portfolio** (`/`) — Drop a Fidelity positions CSV on the upload zone. The file is
parsed in the browser with PapaParse, previewed (including which columns matched and
which rows were skipped), and only written when you confirm.

**Analyzer** (`/analyzer`) — Tickers ranked on EV/FCF and ROIC, both pulled live from
Yahoo Finance. A ticker flags as a potential buy when EV/FCF ≤ 20 and ROIC ≥ 15%;
thresholds live in `src/lib/signals.ts`. Each ticker's page has the share-count
chart, the three qualitative text areas, and P/E and PEG demoted to a "minor notes"
block. Every metric name carries its definition on hover, focus, or click, and the
full list is in the Glossary panel.

**Stock sim** (`/simulator`) — Grow FCF forward, apply an exit multiple, see the
implied share price across bear/base/bull re-rates. Type a ticker to load that
company's real cash flow, share count, and net debt as a starting point. Every input
explains what it is and what a normal value looks like, and the results are restated
in plain English below the chart. Nothing is saved.

**Retirement** (`/retirement`) — Pre-fills the starting balance from your last upload
and projects forward with monthly compounding. The employer match is computed against
the match limit, not your deferral, and charted as its own band.

## CSV resilience

Fidelity's export is not a stable contract, so `src/lib/csv.ts` is written defensively:

- **Header matching is case- and punctuation-insensitive.** Headers are normalized to
  lowercase alphanumerics before lookup, so `Current Value`, `Current value`,
  `CURRENT VALUE`, and `Current-Value` all resolve. Alternate wordings
  (`Market Value`, `Ticker`, `Shares`) are aliased, with a prefix fallback for
  variants like `Current Value ($)`.
- **Money parsing** handles `$1,234.56`, `(45.00)` as negative, and `--` / `n/a` as
  unknown rather than zero.
- **Non-position rows** — pending activity, blank lines, and the disclaimer block at
  the end of the file — are dropped and reported by count in the preview, so a partial
  import is never silent.
- **Account labels** are collapsed to Roth IRA / Traditional IRA / Brokerage and
  friends; anything unrecognized keeps its own label rather than silently becoming
  "Brokerage".

If a required column genuinely can't be found, the import fails with the list of
headers it did see instead of writing partial data.

## Upload semantics

`fidelity_investments` mirrors exactly one upload — the most recent. Each upload also
writes a row to `portfolio_snapshots` with its holdings copied into
`archived_holdings`, so history accumulates while the live table stays clean. The
whole thing runs in one transaction.

## How "live" the live data actually is

Not all of it is live, and the UI says so — open "How current is this data?" on any
ticker page.

| Layer | Freshness | Drives |
|---|---|---|
| Share price | Real-time while the market is open; last close otherwise | Price, daily change |
| Latest quarter | Updates when the company files — quarterly at best | EV/FCF, P/E, PEG, market cap, debt, cash |
| Latest annual report | Up to a year old | ROIC, share count history |

So "live" is honest for the quote and misleading for everything else: an EV/FCF built
on a filing from three months ago does not become current because you refreshed the
page. The refresh button re-pulls from Yahoo; it cannot make a company file sooner.

## What counts as a good number

`src/lib/ratings.ts` holds the bands behind every colored verdict, and the Glossary
panel prints the full scale for each metric. Colors come from the reserved status
palette and always ship with a text label, never color alone.

| Metric | Good | Watch | Bad |
|---|---|---|---|
| EV/FCF | < 20 | 20–45 | > 45 |
| ROIC | > 15% | 10–15% | < 10% |
| Share count | shrinking | flat to +2%/yr | > +2%/yr |
| P/E | < 25 | 25–40 | > 40 |
| PEG | < 1.5 | 1.5–2.5 | > 2.5 |

These are screening heuristics, not valuations — a "Very expensive" reading is a
prompt to look closer, not a sell. Negative EV/FCF and P/E are called out separately,
since a negative ratio would otherwise sort as "cheap."

## Symbols and security types

`src/lib/ticker.ts` owns symbol handling. It is permissive about shape on purpose —
Yahoo decides what exists; this only rejects strings that clearly can't be symbols:

- **Class shares** — brokerages and Yahoo disagree. Fidelity exports `BRK.B`; Yahoo
  wants `BRK-B`. A failed lookup retries the alternate spelling and tells you which
  one Yahoo matched. Only a single trailing letter is treated as a class suffix, so
  exchange suffixes (`SHOP.TO`, `0700.HK`) are left alone.
- **Empty successes** — Yahoo returns HTTP 200 with a blank price block for some
  symbols (`BF.B`) rather than a 404. Those count as a miss and fall through to the
  alternates.
- **Indices and futures** — `^GSPC` and `ES=F` are accepted.
- **Not-a-symbol** — gets an explanatory page with working examples, not a bare 404.

Pages branch on `quoteType`. Operating companies get EV/FCF, ROIC, and the share-count
chart. Funds get a profile, trailing returns, and top holdings instead, because EV/FCF
and ROIC describe a business and a fund doesn't have one. The fund detail call is
isolated in its own try/catch: Yahoo's fund payload fails the library's schema
validation for some mutual funds (`VTSAX`, `FXAIX`), and losing that panel is
acceptable where losing the page is not.

## Live market data

`src/lib/market.ts` is the only module that touches the network.

- **What's fetched:** P/E and PEG (`defaultKeyStatistics` / `summaryDetail`),
  enterprise value, free cash flow, shares outstanding, market cap, debt and cash
  from `quoteSummary`; annual statements and share-count history from
  `fundamentalsTimeSeries`.
- **What's derived:** EV/FCF is enterprise value ÷ free cash flow. **ROIC is not
  published by Yahoo** — it's computed as NOPAT ÷ invested capital, where NOPAT is
  EBIT × (1 − effective tax rate) from the latest annual statements. The ticker page
  labels it as derived. It returns null rather than guessing when an input is
  missing, because a wrong ROIC would flip the buy signal.
- **Caching:** results are held in-process for 15 minutes, and concurrent requests
  for the same ticker collapse into one fetch. Failures aren't cached, so a network
  blip doesn't pin an error in place. "Refresh data" on a ticker page bypasses the TTL.
- **Degradation:** every field is optional. ETFs return no EV/FCF or ROIC and say so;
  an unknown ticker is rejected before a row is created; if the live fetch fails
  entirely, your saved notes still render.

Yahoo's endpoints are unofficial and unversioned. If a metric starts showing "—"
across every ticker, the field has probably moved — `src/lib/market.ts` is where to
look, and the `unwrap()` helper already handles Yahoo's `{ raw, fmt }` shape.

## Charts

Chart colors come from a validated palette (`src/app/globals.css`) rather than being
picked per chart. Series hues are assigned by fixed slot, so "employer match is green"
holds everywhere. Light and dark are separate validated step sets, not an automatic
flip. Every chart has a legend when it has two or more series, a table view for the
same data, and a tooltip that enhances rather than gates access to the numbers.

## Layout

```
prisma/schema.prisma          fidelity_investments, stock_analysis, snapshots
src/lib/csv.ts                header mapping + row parsing (pure, no I/O)
src/lib/market.ts             Yahoo Finance client, ROIC derivation, TTL cache
src/lib/projections.ts        retirement and single-stock math (pure)
src/lib/signals.ts            buy/watch/pass thresholds
src/lib/ratings.ts            good/fair/poor bands behind the colored verdicts
src/lib/glossary.ts           metric definitions — one source of truth
src/app/actions/              server actions — the only things that write
src/components/charts/        Recharts wrappers + shared chart chrome
legacy/                       the previous Python scripts, untouched
```

## Build configuration

`next.config.ts` sets `experimental.workerThreads: false` and `experimental.cpus: 1`.
Next parallelizes static page generation across `jest-worker` child processes; on a
memory-constrained machine one can be OOM-killed, surfacing as *"Jest worker
encountered N child process exceptions"*. Forcing a single in-process worker trades
build speed for stability (page generation drops from 7 workers to 1).

`swcMinify: false` is **not** set and should not be added — it was removed in Next 15,
and on this version it fails the type check and logs `Unrecognized key(s) in object:
'swcMinify'`. Minification is no longer configurable.

## After changing the Prisma schema

Run `npx prisma generate` and restart the dev server. A migration alone updates the
database but leaves the generated client stale, which fails at runtime with
`The column ... does not exist in the current database`.

## legacy/

The Python scripts that used to live here (Spotify tooling, an LSTM price model,
yfinance chart generators) were moved into `legacy/` rather than deleted. Note that
`legacy/stock_ai_lstm.py` and its siblings contain a hardcoded Discord webhook URL,
and `legacy/.cache` holds a Spotify access token — rotate those if they still matter,
and don't commit that directory.
