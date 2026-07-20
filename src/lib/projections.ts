/**
 * Forecasting math. Pure functions, no I/O — the charts are just a view over
 * these arrays, and the numbers can be checked without rendering anything.
 */

export type RetirementInputs = {
  currentAge: number;
  retirementAge: number;
  currentPortfolioValue: number;
  annualSalary: number;
  /** Percent of salary you defer, e.g. 10 for 10%. */
  contributionPct: number;
  /** Employer matches dollar-for-dollar up to this percent of salary. */
  matchLimitPct: number;
  /** Expected annual return (CAGR), e.g. 7 for 7%. */
  expectedReturnPct: number;
  /** Annual raise assumption, e.g. 3 for 3%. */
  salaryGrowthPct: number;
};

export type RetirementYear = {
  age: number;
  year: number;
  /** Your own money: starting balance + everything you deferred. */
  principal: number;
  /** Employer contributions, tracked separately from your principal. */
  employerMatch: number;
  /** Everything the market added on top. */
  growth: number;
  total: number;
  salary: number;
};

export const RETIREMENT_DEFAULTS: RetirementInputs = {
  currentAge: 30,
  retirementAge: 65,
  currentPortfolioValue: 0,
  annualSalary: 90_000,
  contributionPct: 10,
  matchLimitPct: 4,
  expectedReturnPct: 7,
  salaryGrowthPct: 3,
};

/**
 * Year-by-year projection with monthly compounding and monthly contributions.
 *
 * The employer match is computed against the match limit, not your deferral —
 * contributing 15% against a 4% match still only earns 4%, and the extra 11%
 * is yours alone.
 */
export function projectRetirement(input: RetirementInputs): RetirementYear[] {
  const years = Math.max(0, Math.round(input.retirementAge - input.currentAge));
  const monthlyRate = Math.pow(1 + input.expectedReturnPct / 100, 1 / 12) - 1;
  const thisYear = new Date().getFullYear();

  let balance = Math.max(0, input.currentPortfolioValue);
  let principal = balance;
  let employerMatch = 0;
  let salary = Math.max(0, input.annualSalary);

  const rows: RetirementYear[] = [
    {
      age: input.currentAge,
      year: thisYear,
      principal,
      employerMatch,
      growth: 0,
      total: balance,
      salary,
    },
  ];

  for (let y = 1; y <= years; y++) {
    const yourAnnual = salary * (input.contributionPct / 100);
    const matchedPct = Math.min(input.contributionPct, input.matchLimitPct);
    const matchAnnual = salary * (matchedPct / 100);

    const yourMonthly = yourAnnual / 12;
    const matchMonthly = matchAnnual / 12;

    for (let m = 0; m < 12; m++) {
      balance += yourMonthly + matchMonthly;
      balance *= 1 + monthlyRate;
    }

    principal += yourAnnual;
    employerMatch += matchAnnual;

    rows.push({
      age: input.currentAge + y,
      year: thisYear + y,
      principal,
      employerMatch,
      // Residual, so the three bands always sum to the real balance.
      growth: Math.max(0, balance - principal - employerMatch),
      total: balance,
      salary,
    });

    salary *= 1 + input.salaryGrowthPct / 100;
  }

  return rows;
}

export type StockSimInputs = {
  /** Trailing free cash flow, in millions. */
  currentFcf: number;
  /** Shares outstanding, in millions. */
  sharesOutstanding: number;
  /** Net debt (debt minus cash), in millions. Negative means net cash. */
  netDebt: number;
  /** Annual FCF growth, e.g. 12 for 12%. */
  fcfGrowthPct: number;
  /** Annual change in share count, e.g. -2 for a 2% buyback. */
  shareChangePct: number;
  /** Terminal price-to-FCF multiple applied in the final year. */
  terminalMultiple: number;
  years: number;
};

export type StockSimYear = {
  year: number;
  fcf: number;
  shares: number;
  fcfPerShare: number;
  /** Price implied by applying the terminal multiple to that year's FCF. */
  bear: number;
  base: number;
  bull: number;
};

export const STOCK_SIM_DEFAULTS: StockSimInputs = {
  currentFcf: 5_000,
  sharesOutstanding: 1_000,
  netDebt: 0,
  fcfGrowthPct: 10,
  shareChangePct: -1.5,
  terminalMultiple: 20,
  years: 7,
};

/**
 * Scenario spread. Bear and bull re-rate the multiple rather than inventing a
 * different business: multiple compression is what usually decides the outcome
 * over a 5–10 year hold.
 */
const SCENARIO = { bear: 0.65, base: 1, bull: 1.35 };

export function projectStock(input: StockSimInputs): StockSimYear[] {
  const years = Math.max(1, Math.min(30, Math.round(input.years)));
  const rows: StockSimYear[] = [];

  for (let y = 0; y <= years; y++) {
    const fcf = input.currentFcf * Math.pow(1 + input.fcfGrowthPct / 100, y);
    const shares = Math.max(
      1e-6,
      input.sharesOutstanding * Math.pow(1 + input.shareChangePct / 100, y),
    );

    const priceAt = (multiple: number) =>
      Math.max(0, (fcf * multiple - input.netDebt) / shares);

    rows.push({
      year: y,
      fcf,
      shares,
      fcfPerShare: fcf / shares,
      bear: priceAt(input.terminalMultiple * SCENARIO.bear),
      base: priceAt(input.terminalMultiple * SCENARIO.base),
      bull: priceAt(input.terminalMultiple * SCENARIO.bull),
    });
  }

  return rows;
}

/** Compound annual growth rate between two values over n years. */
export function cagr(start: number, end: number, years: number): number | null {
  if (start <= 0 || end <= 0 || years <= 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}
