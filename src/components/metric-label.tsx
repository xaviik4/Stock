"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { define, type MetricKey } from "@/lib/glossary";
import { TARGETS } from "@/lib/ratings";

/**
 * A metric name with its definition attached.
 *
 * The bubble is `position: fixed` and measured from the trigger rather than
 * absolutely positioned inside it, because several of these live inside
 * `overflow-x-auto` table wrappers that would otherwise clip them.
 *
 * Accessibility: the trigger is a real button, so it's reachable by keyboard and
 * announced by screen readers via `aria-describedby`. It opens on hover, focus,
 * and click — never hover alone, which would strand touch and keyboard users.
 */
export function MetricLabel({
  metric,
  children,
  className = "",
}: {
  metric: MetricKey;
  children?: React.ReactNode;
  className?: string;
}) {
  const entry = define(metric);
  const target = TARGETS[metric];
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const WIDTH = 260;
    const MARGIN = 8;
    // Keep the bubble on screen when the trigger sits near either edge.
    const left = Math.min(
      Math.max(MARGIN, rect.left + rect.width / 2 - WIDTH / 2),
      window.innerWidth - WIDTH - MARGIN,
    );
    setCoords({ top: rect.bottom + 6, left });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    // Re-anchor on scroll rather than closing. Closing here looks reasonable
    // but breaks keyboard access outright: focusing an off-screen control
    // scrolls it into view, which would dismiss the tooltip the same tick it
    // opened, so tabbing to a metric would never show its definition.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, hide, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`${entry.term}: ${entry.definition}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault();
          if (open) hide();
          else show();
        }}
        className={`inline-flex items-baseline gap-1 text-left underline decoration-dotted decoration-from-font underline-offset-4 decoration-[var(--text-muted)] hover:decoration-[var(--text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--series-1)] rounded-sm ${className}`}
      >
        {children ?? entry.term}
      </button>

      {open && coords ? (
        <span
          id={tooltipId}
          role="tooltip"
          style={{ top: coords.top, left: coords.left, width: 260 }}
          className="fixed z-50 bg-surface border border-hairline rounded-lg shadow-lg px-3 py-2.5 pointer-events-none"
        >
          <span className="block text-xs font-semibold text-ink">{entry.term}</span>
          <span className="block text-xs text-ink-2 mt-1 leading-relaxed">
            {entry.definition}
          </span>
          {target ? (
            <span className="block text-xs text-ink-muted mt-2 pt-2 border-t border-hairline leading-relaxed">
              {target}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}
