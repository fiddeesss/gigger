import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProofView, RewardPts } from "@/components/proof-view";
import { ReviewPanel } from "@/components/review-panel";
import { StatusBadge, Tag } from "@/components/ui";
import { timeAgo, slaLabel } from "@/lib/dates";
import { REVIEW_SLA_HOURS, FLAG_SLA_HOURS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: submission } = await admin
    .from("submissions")
    .select("*")
    .eq("id", id)
    .single();
  if (!submission) notFound();

  const [{ data: quest }, { data: user }] = await Promise.all([
    admin.from("quests").select("title, reward_points, proof_type, category").eq("id", submission.quest_id).single(),
    admin.from("profiles").select("full_name, email, tier, referral_code").eq("id", submission.user_id).single(),
  ]);
  if (!quest || !user) notFound();

  const reviewable = submission.status === "under_review" || submission.status === "flagged";
  const sla = slaLabel(
    submission.created_at,
    submission.status === "flagged" ? FLAG_SLA_HOURS : REVIEW_SLA_HOURS,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/admin/reviews" className="text-[13px] text-neutral-500">
          ← Queue
        </Link>
        <StatusBadge status={submission.status} kind="submission" />
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[16px] font-semibold leading-snug">{quest.title}</h1>
          <Tag tone="accent" className="flex-none">{quest.category}</Tag>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          <span>{user.full_name || user.email}</span>
          <span>Tier {user.tier}</span>
          <span>code {user.referral_code}</span>
          <span>submitted {timeAgo(submission.created_at)}</span>
          <span className={sla.overdue ? "text-bad" : ""}>{sla.label}</span>
        </div>
        <div className="mt-2">
          Reward if approved: <RewardPts pts={quest.reward_points} />
        </div>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-sm">
        <div className="mb-3 text-[13.5px] font-medium">Proof</div>
        <ProofView proofType={quest.proof_type} payload={submission.payload as Record<string, unknown>} />
      </div>

      {submission.flags?.length > 0 && (
        <div className="rounded-xl bg-warn-bg p-4 text-[12.5px] leading-relaxed text-warn">
          <b>Flagged:</b> {String((submission.flags[0] as { signal?: string }).signal ?? "—")}
          {submission.flags[0]?.note ? ` — ${String((submission.flags[0] as { note?: string }).note)}` : ""}
        </div>
      )}

      {reviewable ? (
        <ReviewPanel submissionId={submission.id} status={submission.status} />
      ) : (
        <div className="rounded-xl bg-surface p-4 text-[13px] text-neutral-500 shadow-sm">
          Reviewed {timeAgo(submission.reviewed_at ?? submission.created_at)}
          {submission.review_note && (
            <p className="mt-2 rounded-lg bg-neutral-900 p-3 text-[12.5px] text-neutral-400">
              “{submission.review_note}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}
