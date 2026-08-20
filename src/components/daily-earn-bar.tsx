import { fmtPeso } from "@/lib/constants";

/**
 * Daily earning card (design B7/B8). Leads with what's STILL available today;
 * the three segments never overstate the balance:
 * solid green = approved today · blue hatch = in review · grey = still available.
 */
export function DailyEarnBar({
  approvedPts,
  inReviewCount,
  availablePts,
  availableCount,
}: {
  approvedPts: number;
  inReviewCount: number;
  availablePts: number;
  availableCount: number;
}) {
  const total = approvedPts + availablePts + inReviewCount * 0; // hatch segment is count, not pts
  const segApproved = approvedPts;
  const segAvailable = availablePts;
  const denom = segApproved + segAvailable || 1;

  return (
    <section className="rounded-xl bg-surface p-4 shadow-sm">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">
        Available to earn today
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold text-accent-300">
          {fmtPeso(availablePts / 100)}
        </span>
        <span className="text-xs text-neutral-500">
          / {availableCount} quest{availableCount === 1 ? "" : "s"} left
        </span>
      </div>

      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-900">
        <div
          className="h-full bg-ok"
          style={{ width: `${(segApproved / denom) * 100}%` }}
          title={`Approved today: ${fmtPeso(approvedPts / 100)}`}
        />
        <div
          className="h-full bg-review"
          style={{
            width: `${(segAvailable / denom) * 100}%`,
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--color-review) 0 4px, transparent 4px 8px)",
          }}
          title={`In review: ${inReviewCount} submission${inReviewCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-2 flex justify-between text-[10.5px] text-neutral-500">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-ok align-middle" />
          {fmtPeso(approvedPts / 100)} approved today
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--color-review) 0 3px, transparent 3px 5px)",
            }}
          />
          {inReviewCount} in review
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-neutral-800 align-middle" />
          still available
        </span>
      </div>

      <p className="mt-2 text-[11px] text-neutral-600">
        No cap on earning — keep going if you want.
      </p>
    </section>
  );
}
