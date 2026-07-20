"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMetrics, type MetricsResult } from "@/lib/market";

function text(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const raw = String(value).trim();
  return raw ? raw : null;
}

const TICKER = /^[A-Z0-9.\-]{1,12}$/;

export type SaveResult = { ok: boolean; message: string };

/**
 * Persist the qualitative notes for a ticker.
 *
 * Quantitative metrics are no longer accepted here — they come from Yahoo on
 * every render, so there is nothing numeric left to save.
 */
export async function saveAnalysis(
  _prev: SaveResult | null,
  formData: FormData,
): Promise<SaveResult> {
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!symbol) return { ok: false, message: "A ticker is required." };
  if (!TICKER.test(symbol)) {
    return { ok: false, message: `"${symbol}" is not a valid ticker.` };
  }

  const data = {
    debtStructure: text(formData.get("debtStructure")),
    industryMoat: text(formData.get("industryMoat")),
    managementAlignment: text(formData.get("managementAlignment")),
  };

  try {
    await prisma.stockAnalysis.upsert({
      where: { symbol },
      create: { symbol, ...data },
      update: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return { ok: false, message: `Save failed: ${message}` };
  }

  revalidatePath("/analyzer");
  revalidatePath(`/analyzer/${symbol}`);
  return { ok: true, message: `Saved notes for ${symbol}.` };
}

/**
 * Validate a ticker against Yahoo before creating a row, so a typo doesn't
 * leave an empty un-fetchable entry in the tracker.
 */
export async function startAnalysis(formData: FormData): Promise<void> {
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!symbol || !TICKER.test(symbol)) {
    redirect("/analyzer?error=invalid-ticker");
  }

  const metrics = await getMetrics(symbol);
  if (!metrics.ok) {
    redirect(`/analyzer?error=not-found&symbol=${encodeURIComponent(symbol)}`);
  }

  await prisma.stockAnalysis.upsert({
    where: { symbol },
    create: { symbol },
    update: {},
  });

  revalidatePath("/analyzer");
  redirect(`/analyzer/${symbol}`);
}

export async function deleteAnalysis(formData: FormData): Promise<void> {
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!symbol) return;
  await prisma.stockAnalysis.delete({ where: { symbol } }).catch(() => {});
  revalidatePath("/analyzer");
  redirect("/analyzer");
}

/** Bypass the TTL cache and re-pull from Yahoo on demand. */
export async function refreshMetrics(symbol: string): Promise<MetricsResult> {
  const result = await getMetrics(symbol, { force: true });
  revalidatePath(`/analyzer/${symbol.trim().toUpperCase()}`);
  revalidatePath("/analyzer");
  return result;
}

export type PrefillResult =
  | {
      ok: true;
      symbol: string;
      name: string | null;
      currentFcf: number;
      sharesOutstanding: number;
      netDebt: number;
      price: number | null;
    }
  | { ok: false; error: string };

/**
 * Load a real company's figures into the simulator.
 *
 * The simulator is far more useful started from actual numbers than from a
 * blank form — the point is to vary assumptions against a real baseline, not to
 * invent one. Values are converted to the millions the simulator works in.
 */
export async function prefillSimulator(rawSymbol: string): Promise<PrefillResult> {
  const result = await getMetrics(rawSymbol);
  if (!result.ok) return { ok: false, error: result.error };

  const d = result.data;
  if (d.quoteType !== "EQUITY") {
    return {
      ok: false,
      error: `${d.symbol} is not an operating company, so it has no free cash flow to project.`,
    };
  }
  if (d.freeCashFlow === null || d.sharesOutstanding === null) {
    return {
      ok: false,
      error: `Yahoo didn't report free cash flow or share count for ${d.symbol}.`,
    };
  }

  const M = 1_000_000;
  return {
    ok: true,
    symbol: d.symbol,
    name: d.name,
    currentFcf: Math.round((d.freeCashFlow / M) * 10) / 10,
    sharesOutstanding: Math.round((d.sharesOutstanding / M) * 10) / 10,
    // Net debt is debt minus cash; negative means the company holds net cash.
    netDebt:
      d.totalDebt === null && d.totalCash === null
        ? 0
        : Math.round((((d.totalDebt ?? 0) - (d.totalCash ?? 0)) / M) * 10) / 10,
    price: d.price,
  };
}
