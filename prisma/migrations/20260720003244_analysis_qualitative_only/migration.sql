/*
  Warnings:

  - You are about to drop the `share_count_points` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `ev_fcf` on the `stock_analysis` table. All the data in the column will be lost.
  - You are about to drop the column `pe_ratio` on the `stock_analysis` table. All the data in the column will be lost.
  - You are about to drop the column `peg_ratio` on the `stock_analysis` table. All the data in the column will be lost.
  - You are about to drop the column `roic` on the `stock_analysis` table. All the data in the column will be lost.
  - You are about to drop the column `share_count_trend` on the `stock_analysis` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "share_count_points_symbol_period_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "share_count_points";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_stock_analysis" (
    "symbol" TEXT NOT NULL PRIMARY KEY,
    "debt_structure" TEXT,
    "industry_moat" TEXT,
    "management_alignment" TEXT,
    "last_updated" DATETIME NOT NULL
);
INSERT INTO "new_stock_analysis" ("debt_structure", "industry_moat", "last_updated", "management_alignment", "symbol") SELECT "debt_structure", "industry_moat", "last_updated", "management_alignment", "symbol" FROM "stock_analysis";
DROP TABLE "stock_analysis";
ALTER TABLE "new_stock_analysis" RENAME TO "stock_analysis";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
