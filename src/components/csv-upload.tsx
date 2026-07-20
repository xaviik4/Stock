"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { buildHoldings, type ParseReport } from "@/lib/csv";
import { replacePortfolio } from "@/app/actions/portfolio";
import { money } from "@/lib/format";
import { buttonClass, secondaryButtonClass } from "@/components/ui";

type Status =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "preview"; report: ParseReport; fileName: string }
  | { kind: "error"; message: string }
  | { kind: "done"; imported: number; totalValue: number };

export function CsvUpload() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [saving, startSaving] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = useCallback((file: File) => {
    if (!/\.csv$/i.test(file.name)) {
      setStatus({ kind: "error", message: "That doesn't look like a .csv file." });
      return;
    }
    setStatus({ kind: "parsing" });

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      // Fidelity pads the top of some exports with a blank line.
      transformHeader: (header) => header.replace(/ /g, " ").trim(),
      complete: (results) => {
        try {
          const headers = results.meta.fields ?? [];
          const report = buildHoldings(results.data, headers);
          if (report.holdings.length === 0) {
            setStatus({
              kind: "error",
              message: "The headers matched, but no position rows survived parsing.",
            });
            return;
          }
          setStatus({ kind: "preview", report, fileName: file.name });
        } catch (error) {
          setStatus({
            kind: "error",
            message: error instanceof Error ? error.message : "Could not read that CSV.",
          });
        }
      },
      error: (error) => {
        setStatus({ kind: "error", message: `PapaParse failed: ${error.message}` });
      },
    });
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const commit = useCallback(() => {
    if (status.kind !== "preview") return;
    const { report, fileName } = status;
    startSaving(async () => {
      const result = await replacePortfolio(report.holdings, fileName);
      if (result.ok) {
        setStatus({
          kind: "done",
          imported: result.imported,
          totalValue: result.totalValue,
        });
        router.refresh();
      } else {
        setStatus({ kind: "error", message: result.error });
      }
    });
  }, [status, router]);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload a Fidelity positions CSV"
        className={`border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--series-1)] ${
          dragging
            ? "border-[var(--series-1)] bg-surface-2"
            : "border-hairline hover:border-[var(--axis)] hover:bg-surface-2"
        }`}
      >
        <p className="text-sm font-medium">
          Drop your Fidelity positions CSV here, or click to browse
        </p>
        <p className="text-xs text-ink-muted mt-1.5">
          Headers are matched case-insensitively, so a rename from &ldquo;Current
          Value&rdquo; to &ldquo;Current value&rdquo; won&rsquo;t break the import.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {status.kind === "parsing" ? (
        <p className="text-sm text-ink-2 mt-4">Parsing…</p>
      ) : null}

      {status.kind === "error" ? (
        <div className="mt-4 rounded-lg border border-hairline bg-surface-2 px-4 py-3">
          <p className="text-sm font-medium text-[var(--status-critical)]">
            Import failed
          </p>
          <p className="text-sm text-ink-2 mt-1">{status.message}</p>
        </div>
      ) : null}

      {status.kind === "done" ? (
        <div className="mt-4 rounded-lg border border-hairline bg-surface-2 px-4 py-3">
          <p className="text-sm font-medium text-[var(--success-text)]">
            Imported {status.imported} holdings · {money(status.totalValue)}
          </p>
          <p className="text-sm text-ink-2 mt-1">
            The live portfolio now matches this file. The previous upload is kept in
            history.
          </p>
        </div>
      ) : null}

      {status.kind === "preview" ? (
        <Preview
          report={status.report}
          fileName={status.fileName}
          saving={saving}
          onCancel={() => setStatus({ kind: "idle" })}
          onCommit={commit}
        />
      ) : null}
    </div>
  );
}

function Preview({
  report,
  fileName,
  saving,
  onCancel,
  onCommit,
}: {
  report: ParseReport;
  fileName: string;
  saving: boolean;
  onCancel: () => void;
  onCommit: () => void;
}) {
  const accounts = [...new Set(report.holdings.map((h) => h.accountType))];

  return (
    <div className="mt-5 rounded-xl border border-hairline overflow-hidden">
      <div className="px-4 py-3 bg-surface-2 border-b border-hairline">
        <p className="text-sm font-medium">
          {report.holdings.length} holdings · {money(report.totalValue)} ·{" "}
          {accounts.length} account{accounts.length === 1 ? "" : "s"}
        </p>
        <p className="text-xs text-ink-muted mt-1 break-all">{fileName}</p>
      </div>

      <div className="px-4 py-3 border-b border-hairline">
        <p className="text-xs text-ink-muted uppercase tracking-wide mb-2">
          Columns matched
        </p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
          {(
            [
              ["Account", report.headerMap.account],
              ["Symbol", report.headerMap.symbol],
              ["Quantity", report.headerMap.quantity],
              ["Current value", report.headerMap.currentValue],
            ] as const
          ).map(([label, matched]) => (
            <div key={label}>
              <dt className="text-ink-muted">{label}</dt>
              <dd className="text-ink font-medium truncate" title={matched}>
                {matched}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {report.skipped.length > 0 ? (
        <div className="px-4 py-3 border-b border-hairline">
          <p className="text-xs text-ink-muted">
            Skipped:{" "}
            {report.skipped.map((s) => `${s.count} × ${s.reason.toLowerCase()}`).join(", ")}
          </p>
        </div>
      ) : null}

      <div className="max-h-72 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-left text-xs text-ink-muted">
              <th className="px-4 py-2 font-medium">Symbol</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium text-right">Quantity</th>
              <th className="px-4 py-2 font-medium text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {report.holdings.slice(0, 100).map((h) => (
              <tr
                key={`${h.accountType}-${h.symbol}`}
                className="border-t border-hairline"
              >
                <td className="px-4 py-2 font-medium">{h.symbol}</td>
                <td className="px-4 py-2 text-ink-2">{h.accountType}</td>
                <td className="px-4 py-2 text-right tnum text-ink-2">
                  {h.quantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}
                </td>
                <td className="px-4 py-2 text-right tnum">{money(h.currentValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.holdings.length > 100 ? (
          <p className="px-4 py-2 text-xs text-ink-muted border-t border-hairline">
            + {report.holdings.length - 100} more
          </p>
        ) : null}
      </div>

      <div className="px-4 py-3 bg-surface-2 border-t border-hairline flex flex-wrap gap-2 items-center">
        <button onClick={onCommit} disabled={saving} className={buttonClass}>
          {saving ? "Saving…" : "Replace portfolio"}
        </button>
        <button onClick={onCancel} disabled={saving} className={secondaryButtonClass}>
          Cancel
        </button>
        <p className="text-xs text-ink-muted">
          This overwrites the live holdings table and archives a snapshot.
        </p>
      </div>
    </div>
  );
}
