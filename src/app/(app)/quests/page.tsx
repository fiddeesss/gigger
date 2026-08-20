import { createClient } from "@/lib/supabase/server";
import { QuestFeed } from "@/components/quest-feed";
import { effectiveTier } from "@/lib/state";
import { canAttempt, isNewToday } from "@/lib/quests";
import { isTodayUTC, manilaDayStartUTC } from "@/lib/dates";
import type { Submission } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: quests }, { data: submissions }, { data: ledgerToday }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("quests").select("*").eq("status", "live"),
      supabase
        .from("submissions")
        .select("id, quest_id, status, created_at")
        .eq("user_id", user.id),
      supabase
        .from("wallet_ledger")
        .select("delta_points, created_at")
        .eq("user_id", user.id)
        .gte("created_at", new Date(manilaDayStartUTC()).toISOString()),
    ]);

  const mySubmissions: Record<string, Submission> = {};
  for (const s of submissions ?? []) {
    if (!mySubmissions[s.quest_id]) mySubmissions[s.quest_id] = s as Submission;
  }

  const tier = effectiveTier(profile ?? { tier: 0 });
  const approvedPts = (ledgerToday ?? [])
    .filter((r) => isTodayUTC(r.created_at))
    .reduce((sum, r) => sum + (r.delta_points ?? 0), 0);
  const inReviewCount = (submissions ?? []).filter(
    (s) => s.status === "under_review" || s.status === "flagged",
  ).length;

  const available = (quests ?? []).filter(
    (q) => !mySubmissions[q.id] && canAttempt(q, profile ?? { tier: 0 }).ok,
  );
  const availablePts = available.reduce((sum, q) => sum + q.reward_points, 0);

  return (
    <QuestFeed
      quests={quests ?? []}
      mySubmissions={mySubmissions}
      minTier={tier}
      stats={{
        approvedPts: Math.max(0, approvedPts),
        inReviewCount,
        availablePts,
        availableCount: available.length,
      }}
    />
  );
}
