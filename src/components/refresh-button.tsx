"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshMetrics } from "@/app/actions/analysis";
import { secondaryButtonClass } from "@/components/ui";

/** Bypasses the 15-minute TTL and re-pulls this ticker from Yahoo. */
export function RefreshButton({ symbol }: { symbol: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await refreshMetrics(symbol);
            if (!result.ok) setError(result.error);
            router.refresh();
          })
        }
        className={secondaryButtonClass}
      >
        {pending ? "Refreshing…" : "Refresh data"}
      </button>
      {error ? (
        <p className="text-xs text-[var(--status-critical)] mt-1 max-w-[220px]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
