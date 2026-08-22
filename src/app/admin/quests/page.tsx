import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuestStatusChip, QuestRowActions } from "@/components/quest-admin";
import { RewardLockup } from "@/components/ui";
import { timeAgo } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminQuestsPage() {
  const admin = createAdminClient();
  const { data: quests } = await admin
    .from("quests")
    .select("id, title, slug, reward_points, category, proof_type, status, slots_used, slots_total, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Quests</h1>
        <Link
          href="/admin/quests/new"
          className="rounded-lg bg-section px-3.5 py-2 text-[13px] font-medium text-white hover:bg-section-glow"
        >
          + New quest
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {!quests?.length ? (
          <li className="rounded-xl bg-surface p-8 text-center text-sm text-neutral-500 shadow-sm">
            No quests yet — create the first one.
          </li>
        ) : (
          quests.map((q) => (
            <li key={q.id} className="rounded-xl bg-surface p-3.5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-medium">{q.title}</span>
                  <span className="truncate text-[11px] text-neutral-500">
                    {q.category} · {q.proof_type} · created {timeAgo(q.created_at)} ·{" "}
                    {q.slots_total === null ? "∞ slots" : `${q.slots_used}/${q.slots_total} used`}
                  </span>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <RewardLockup pts={q.reward_points} />
                  <QuestStatusChip status={q.status} />
                  <QuestRowActions id={q.id} status={q.status} />
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
