import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge, Tag } from "@/components/ui";
import { timeAgo, slaLabel } from "@/lib/dates";
import { REVIEW_SLA_HOURS, FLAG_SLA_HOURS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ only?: string; reviewed?: string }>;
}) {
  const { only, reviewed } = await searchParams;
  const admin = createAdminClient();

  const statuses = only === "flagged" ? ["flagged"] : ["under_review", "flagged"];
  const { data: submissions } = await admin
    .from("submissions")
    .select("id, quest_id, user_id, status, flags, created_at")
    .in("status", statuses)
    .order("created_at", { ascending: true });

  const userIds = [...new Set((submissions ?? []).map((s) => s.user_id))];
  const questIds = [...new Set((submissions ?? []).map((s) => s.quest_id))];
  const [{ data: users }, { data: quests }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, tier").in("id", userIds),
    admin.from("quests").select("id, title").in("id", questIds),
  ]);
  const userById = Object.fromEntries((users ?? []).map((u) => [u.id, u]));
  const questById = Object.fromEntries((quests ?? []).map((q) => [q.id, q]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Review queue</h1>
        <Link
          href="/admin/reviews"
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${only === "flagged" ? "bg-surface text-neutral-400" : "bg-section text-white"}`}
        >
          All
        </Link>
      </div>

      {reviewed && (
        <p className="rounded-lg bg-ok-bg px-3.5 py-2.5 text-xs text-ok">Review saved.</p>
      )}

      {!submissions?.length ? (
        <div className="rounded-xl bg-surface p-8 text-center text-sm text-neutral-500 shadow-sm">
          Queue is clear. 🎉
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {submissions.map((s) => {
            const u = userById[s.user_id];
            const q = questById[s.quest_id];
            const sla = slaLabel(
              s.created_at,
              s.status === "flagged" ? FLAG_SLA_HOURS : REVIEW_SLA_HOURS,
            );
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/reviews/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-medium">{q?.title ?? "Quest"}</span>
                    <span className="truncate text-xs text-neutral-500">
                      {u?.full_name || u?.email} · {timeAgo(s.created_at)}
                    </span>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {s.status === "flagged" && (
                      <Tag tone="warn">
                        {String((s.flags as { signal?: string }[])?.[0]?.signal ?? "flagged")}
                      </Tag>
                    )}
                    <span className={`text-[10.5px] ${sla.overdue ? "text-bad" : "text-neutral-500"}`}>
                      {sla.label}
                    </span>
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
