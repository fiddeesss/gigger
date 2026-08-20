import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProofView } from "@/components/proof-view";
import { ReviewTimeline } from "@/components/review-timeline";
import { StatusBadge, Tag } from "@/components/ui";
import { fmtPts, fmtPeso, REVIEW_SLA_HOURS, FLAG_SLA_HOURS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function WorkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resubmitted?: string }>;
}) {
  const [{ id }, { resubmitted }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: submission } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!submission) notFound();

  const admin = createAdminClient();
  const { data: quest } = await admin
    .from("quests")
    .select("title, reward_points, proof_type")
    .eq("id", submission.quest_id)
    .single();
  if (!quest) notFound();

  const deadlineMs =
    Date.parse(submission.created_at) +
    (submission.status === "flagged" ? FLAG_SLA_HOURS : REVIEW_SLA_HOURS) * 3600 * 1000;
  const flag = (submission.flags as { signal?: string; note?: string }[])?.[0];

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <Link href="/work" className="text-[13px] text-neutral-500">
          ← My work
        </Link>
        <StatusBadge status={submission.status} kind="submission" />
      </div>

      {resubmitted && (
        <p className="rounded-lg bg-ok-bg px-3.5 py-2.5 text-xs text-ok">
          Resubmitted — it&apos;s back under review.
        </p>
      )}

      <div className="rounded-xl bg-surface p-4 shadow-sm">
        <h1 className="text-[16px] font-semibold leading-snug">{quest.title}</h1>
        {quest.reward_points > 0 && (
          <p className="mt-1 text-xs text-neutral-500">
            Reward: <b className="text-accent-300">{fmtPts(quest.reward_points)}</b> ={" "}
            {fmtPeso(quest.reward_points / 100)}
          </p>
        )}
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-sm">
        <div className="mb-3 text-[13.5px] font-medium">Your proof</div>
        <ProofView proofType={quest.proof_type} payload={submission.payload as Record<string, unknown>} />
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-sm">
        <ReviewTimeline
          submittedAt={submission.created_at}
          status={submission.status}
          deadlineMs={deadlineMs}
        />
      </div>

      {submission.status === "flagged" && flag && (
        <div className="rounded-xl bg-warn-bg p-4 text-[12.5px] leading-relaxed text-warn">
          <b>Why this was flagged:</b> {flag.signal ?? "extra review"}.
          <br />
          A second reviewer will look at it within 72h. Your other quests are
          <b> not</b> affected — this does not count against you.
        </div>
      )}

      {submission.status === "rejected" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-bad-bg p-4 text-[12.5px] leading-relaxed text-bad">
            <b>Reviewer&apos;s note:</b> “{submission.review_note ?? "No note left"}”
          </div>
          <Link
            href={`/work/${submission.id}/resubmit`}
            className="grid min-h-[48px] place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow"
          >
            Resubmit with fixes
          </Link>
          <p className="text-center text-[11px] text-neutral-500">
            Reviews are human and humans err — if you think this is wrong,{" "}
            <a href="mailto:support@pisoquest.app" className="text-accent-400 underline">
              appeal
            </a>
            .
          </p>
        </div>
      )}

      {submission.status === "approved" && (
        <div className="rounded-xl bg-ok-bg p-4 text-[12.5px] text-ok">
          <b>Approved!</b> {fmtPts(quest.reward_points)} ({fmtPeso(quest.reward_points / 100)}) is
          in your wallet.
        </div>
      )}

      {submission.status === "under_review" && (
        <Link href="/quests" className="text-center text-[13px] font-medium text-accent-400">
          Keep questing while you wait →
        </Link>
      )}
    </div>
  );
}
