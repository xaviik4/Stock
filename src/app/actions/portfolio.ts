"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ParsedHolding } from "@/lib/csv";

export type ImportResult =
  | { ok: true; imported: number; totalValue: number; accounts: number }
  | { ok: false; error: string };

/**
 * Replace the live portfolio with a freshly uploaded set of holdings.
 *
 * Each upload also lands in `portfolio_snapshots` before the live table is
 * refreshed, so history accumulates instead of being thrown away — the
 * "wipe on upload" behaviour is only true of the live table.
 */
export async function replacePortfolio(
  holdings: ParsedHolding[],
  fileName: string | null,
): Promise<ImportResult> {
  if (!Array.isArray(holdings) || holdings.length === 0) {
    return { ok: false, error: "No holdings were found in that file." };
  }

  // The action is reachable by direct POST, so re-validate rather than trusting
  // the shape the client sent.
  const clean: ParsedHolding[] = [];
  for (const h of holdings) {
    const symbol = String(h?.symbol ?? "").trim().toUpperCase();
    const accountType = String(h?.accountType ?? "").trim();
    const quantity = Number(h?.quantity);
    const currentValue = Number(h?.currentValue);
    if (!symbol || !accountType) continue;
    if (!Number.isFinite(quantity) || !Number.isFinite(currentValue)) continue;
    clean.push({
      symbol,
      accountType,
      accountLabel: String(h?.accountLabel ?? accountType),
      quantity,
      currentValue,
    });
  }

  if (clean.length === 0) {
    return { ok: false, error: "Every row in that file failed validation." };
  }

  const uploadDate = new Date();
  const totalValue = clean.reduce((sum, h) => sum + h.currentValue, 0);

  try {
    await prisma.$transaction(async (tx) => {
      const snapshot = await tx.portfolioSnapshot.create({
        data: {
          uploadDate,
          fileName,
          totalValue,
          rowCount: clean.length,
        },
      });

      await tx.archivedHolding.createMany({
        data: clean.map((h) => ({
          snapshotId: snapshot.id,
          accountType: h.accountType,
          symbol: h.symbol,
          quantity: h.quantity,
          currentValue: h.currentValue,
        })),
      });

      // The live table mirrors exactly one upload: today's.
      await tx.fidelityInvestment.deleteMany({});
      await tx.fidelityInvestment.createMany({
        data: clean.map((h) => ({
          accountType: h.accountType,
          symbol: h.symbol,
          quantity: h.quantity,
          currentValue: h.currentValue,
          uploadDate,
        })),
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return { ok: false, error: `Could not save the portfolio: ${message}` };
  }

  revalidatePath("/");
  revalidatePath("/analyzer");
  revalidatePath("/retirement");

  return {
    ok: true,
    imported: clean.length,
    totalValue,
    accounts: new Set(clean.map((h) => h.accountType)).size,
  };
}
