import { fmtPeso, fmtPts } from "@/lib/constants";
import { cn } from "@/lib/cn";

/**
 * The balance chip — lives in the header of every tabbed screen.
 * Design rule (B2): the money renders first, before the feed loads.
 */
export function BalanceChip({
  pts,
  className,
}: {
  pts: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium shadow-sm",
        className,
      )}
    >
      <span className="text-accent-300">{fmtPts(pts)}</span>
      <span className="text-neutral-500">{fmtPeso(pts / 100)}</span>
    </span>
  );
}
