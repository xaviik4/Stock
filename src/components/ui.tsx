import type { ReactNode } from "react";
import { MetricLabel } from "@/components/metric-label";
import type { MetricKey } from "@/lib/glossary";
import type { Rating } from "@/lib/ratings";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-surface border border-hairline rounded-xl p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
      {hint ? <p className="text-xs text-ink-muted mt-1">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {lede ? <p className="text-sm text-ink-2 mt-1.5 max-w-2xl">{lede}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/**
 * A single number is a stat tile, not a one-bar chart. Values use proportional
 * figures — tabular-nums is for columns that align vertically.
 */
export function StatTile({
  label,
  metric,
  value,
  sub,
  rating,
  emphasis = false,
}: {
  label: string;
  /** Attaches the glossary definition to the tile's label. */
  metric?: MetricKey;
  value: string;
  sub?: ReactNode;
  /** Colored verdict — the number plus whether that number is good. */
  rating?: Rating;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-surface border border-hairline rounded-xl px-5 py-4">
      <div className="text-xs text-ink-muted uppercase tracking-wide">
        {metric ? <MetricLabel metric={metric}>{label}</MetricLabel> : label}
      </div>
      <div
        className={`mt-1.5 font-semibold tracking-tight ${
          emphasis ? "text-3xl" : "text-2xl"
        }`}
      >
        {value}
      </div>
      {rating ? (
        <div className="mt-1.5">
          <StatusPill tone={rating.tone}>{rating.label}</StatusPill>
          <p className="text-xs text-ink-2 mt-1 leading-relaxed">{rating.note}</p>
        </div>
      ) : null}
      {sub ? <div className="text-xs text-ink-2 mt-1">{sub}</div> : null}
    </div>
  );
}

const TONE_STYLES: Record<string, { dot: string; text: string }> = {
  good: { dot: "bg-good", text: "text-[var(--success-text)]" },
  warning: { dot: "bg-warning", text: "text-ink-2" },
  serious: { dot: "bg-serious", text: "text-ink-2" },
  critical: { dot: "bg-critical", text: "text-[var(--status-critical)]" },
  neutral: { dot: "bg-[var(--axis)]", text: "text-ink-2" },
};

/**
 * Status never rides on color alone — the dot is paired with its label, per the
 * accessibility rule for the reserved status palette.
 */
export function StatusPill({
  tone,
  children,
}: {
  tone: keyof typeof TONE_STYLES | string;
  children: ReactNode;
}) {
  const style = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${style.text}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} aria-hidden />
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-2 mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-ink-muted mt-1">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full bg-page border border-hairline rounded-lg px-3 py-2 text-sm text-ink " +
  "tnum focus:outline-none focus:ring-2 focus:ring-[var(--series-1)] focus:border-transparent";

export const textareaClass =
  "w-full bg-page border border-hairline rounded-lg px-3 py-2 text-sm text-ink " +
  "leading-relaxed resize-y min-h-[104px] focus:outline-none focus:ring-2 " +
  "focus:ring-[var(--series-1)] focus:border-transparent";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm " +
  "font-medium bg-[var(--series-1)] text-white hover:opacity-90 transition-opacity " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm " +
  "font-medium bg-surface-2 text-ink border border-hairline hover:bg-page " +
  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-hairline rounded-xl px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children ? <div className="text-sm text-ink-2 mt-2">{children}</div> : null}
    </div>
  );
}
