import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/ui";
import { timeAgo, slaLabel } from "@/lib/dates";
import { REVIEW_SLA_HOURS, FLAG_SLA_HOURS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, quest_id, status, created_at, points_awarded")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const questIds = [...new Set((submissions ?? []).map((s) => s.quest_id))];
  const admin = createAdminClient();
  const { data: quests } = await admin
    .from("quests")
    .select("id, title")
    .in("id", questIds);
  const questById = Object.fromEntries((quests ?? []).map((q) => [q.id, q]));

  const pending = (submissions ?? []).filter(
    (s) => s.status === "under_review" || s.status === "flagged",
  ).length;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div>
        <h1 className="text-[18px] font-semibold">My work</h1>
        {pending > 0 && (
          <p className="mt-0.5 text-xs text-neutral-500">
            {pending} submission{pending === 1 ? "" : "s"} under review
          </p>
        )}
      </div>

      {!submissions?.length ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-surface p-8 text-center shadow-sm">
          <div className="text-[15px] font-medium">Nothing here yet</div>
          <p className="text-xs text-neutral-500">
            Complete a quest and your submission will show up here with its
            review status.
          </p>
          <Link href="/quests" className="mt-1 text-[13px] font-medium text-accent-400">
            Browse quests →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {submissions.map((s) => {
            const sla = slaLabel(
              s.created_at,
              s.status === "flagged" ? FLAG_SLA_HOURS : REVIEW_SLA_HOURS,
            );
            return (
              <li key={s.id}>
                <Link
                  href={`/work/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-medium">
                      {questById[s.quest_id]?.title ?? "Quest"}
                    </span>
                    <span className="text-xs text-neutral-500">{timeAgo(s.created_at)}</span>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {s.status === "under_review" && (
                      <span className={`text-[10.5px] ${sla.overdue ? "text-bad" : "text-neutral-500"}`}>
                        {sla.label}
                      </span>
                    )}
                    <StatusBadge status={s.status} kind="submission" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
