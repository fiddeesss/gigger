import { formatDeadline } from "@/lib/dates";
import { cn } from "@/lib/cn";

/**
 * Design C4: the confirmation IS the lifecycle. Three steps, a hard deadline,
 * both outcomes named. Reused on My Work (Phase 4).
 */
export function ReviewTimeline({
  submittedAt,
  status,
  deadlineMs,
}: {
  submittedAt: string;
  status: "under_review" | "approved" | "rejected" | "flagged";
  deadlineMs: number;
}) {
  const steps = [
    { key: "submitted", label: "Submitted" },
    { key: "review", label: "Under Review", extra: formatDeadline(deadlineMs) },
    { key: "done", label: status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Outcome" },
  ];

  const idx = status === "approved" || status === "rejected" ? 2 : status === "flagged" ? 1 : 1;

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "active" : "todo";
        return (
          <li key={s.key} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-semibold",
                state === "done" && "bg-ok-bg text-ok",
                state === "active" && "bg-review-bg text-review",
                state === "todo" && "bg-neutral-900 text-neutral-500",
              )}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span className="flex flex-col">
              <span className={cn("text-[13.5px] font-medium", state === "todo" && "text-neutral-500")}>
                {s.label}
                {state === "active" && s.key === "review" && status === "flagged" && (
                  <span className="ml-2 rounded-md bg-warn-bg px-1.5 py-0.5 text-[10.5px] font-medium text-warn">
                    extra review
                  </span>
                )}
              </span>
              {s.extra && <span className="text-[11.5px] text-neutral-500">{s.extra}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
