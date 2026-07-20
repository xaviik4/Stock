-- CreateTable
CREATE TABLE "fidelity_investments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "current_value" REAL NOT NULL,
    "upload_date" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "upload_date" DATETIME NOT NULL,
    "file_name" TEXT,
    "total_value" REAL NOT NULL,
    "row_count" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "archived_holdings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot_id" INTEGER NOT NULL,
    "account_type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "current_value" REAL NOT NULL,
    CONSTRAINT "archived_holdings_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "portfolio_snapshots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_analysis" (
    "symbol" TEXT NOT NULL PRIMARY KEY,
    "ev_fcf" REAL,
    "roic" REAL,
    "share_count_trend" REAL,
    "pe_ratio" REAL,
    "peg_ratio" REAL,
    "debt_structure" TEXT,
    "industry_moat" TEXT,
    "management_alignment" TEXT,
    "last_updated" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "share_count_points" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "shares" REAL NOT NULL,
    CONSTRAINT "share_count_points_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "stock_analysis" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "fidelity_investments_symbol_idx" ON "fidelity_investments"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "fidelity_investments_account_type_symbol_key" ON "fidelity_investments"("account_type", "symbol");

-- CreateIndex
CREATE INDEX "archived_holdings_snapshot_id_idx" ON "archived_holdings"("snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_count_points_symbol_period_key" ON "share_count_points"("symbol", "period");
