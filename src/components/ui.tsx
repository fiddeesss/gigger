import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  SUBMISSION_STATUS_META,
  REDEMPTION_STATUS_META,
  type SubmissionStatus,
  type RedemptionStatus,
} from "@/lib/state";
import { fmtPeso } from "@/lib/constants";

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="grid place-items-center rounded-[9px] bg-accent-900 font-semibold text-accent-300"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        ₱
      </span>
      <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.55 }}>
        PisoQuest
      </span>
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  block,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  block?: boolean;
}) {
  const styles: Record<ButtonVariant, string> = {
    // Design doc overrides: primary is a solid deep-green fill, not outline.
    primary:
      "bg-section text-white border border-section hover:bg-section-glow disabled:opacity-45",
    secondary:
      "bg-surface text-neutral-200 border border-neutral-800 hover:bg-neutral-900",
    ghost:
      "bg-transparent text-accent-300 border border-transparent hover:bg-accent-900",
  };
  return (
    <button
      className={cn(
        "rounded-lg px-5 py-3 text-[15px] font-medium transition-colors",
        styles[variant],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
}

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "accent" | "neutral" | "review" | "ok" | "bad" | "warn";
  className?: string;
}) {
  const tones: Record<string, string> = {
    accent: "bg-accent-800 text-accent-100",
    neutral: "bg-neutral-800 text-neutral-200",
    review: "bg-review-bg text-review",
    ok: "bg-ok-bg text-ok",
    bad: "bg-bad-bg text-bad",
    warn: "bg-warn-bg text-warn",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Gold money chip: "= ₱2.50" — part of every points lockup, never decoration. */
export function MoneyChip({ peso, className }: { peso: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-gold-border bg-gold-bg px-1.5 py-0.5 text-[11px] font-medium text-gold",
        className,
      )}
    >
      = {fmtPeso(peso)}
    </span>
  );
}

/** Points + peso lockup — printed beside every points figure, everywhere. */
export function RewardLockup({ pts }: { pts: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[15px] font-semibold text-accent-300">
        +{pts.toLocaleString("en-PH")} pts
      </span>
      <MoneyChip peso={pts / 100} />
    </span>
  );
}

const TONE_CLASSES: Record<string, string> = {
  review: "bg-review-bg text-review",
  ok: "bg-ok-bg text-ok",
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
  neutral: "bg-neutral-800 text-neutral-300",
};

export function StatusBadge({
  status,
  kind,
}: {
  status: SubmissionStatus | RedemptionStatus;
  kind: "submission" | "redemption";
}) {
  const meta =
    kind === "submission"
      ? SUBMISSION_STATUS_META[status as SubmissionStatus]
      : REDEMPTION_STATUS_META[status as RedemptionStatus];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium",
        TONE_CLASSES[meta.tone],
      )}
    >
      {meta.label}
    </span>
  );
}

export function EffortDots({ level, className }: { level: number; className?: string }) {
  return (
    <span className={cn("text-[11px] tracking-tight", className)}>
      Effort{" "}
      <b className="text-neutral-300">
        {"●".repeat(level)}
        {"○".repeat(3 - level)}
      </b>
    </span>
  );
}
