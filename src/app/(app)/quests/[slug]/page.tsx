import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RewardLockup, Tag, EffortDots, StatusBadge } from "@/components/ui";
import { CATEGORY_LABELS, canAttempt, isNewToday, slotsLeft } from "@/lib/quests";
import { effectiveTier } from "@/lib/state";

export const dynamic = "force-dynamic";

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: quest } = await supabase
    .from("quests")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .single();

  if (!quest || !user) notFound();

  const [{ data: profile }, { data: mySubmission }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("submissions")
      .select("*")
      .eq("quest_id", quest.id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const tier = effectiveTier(profile ?? { tier: 0 });
  const attempt = canAttempt(quest, profile ?? { tier: 0 });
  const slots = slotsLeft(quest);
  const newToday = isNewToday(quest);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center gap-1.5">
        <Link href="/quests" className="rounded-lg px-2 py-1.5 text-[13px] text-neutral-500 hover:bg-neutral-900">
          ← Quests
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[18px] font-semibold leading-snug">{quest.title}</h1>
          <Tag tone="accent" className="flex-none">
            {CATEGORY_LABELS[quest.category]}
          </Tag>
        </div>

        <RewardLockup pts={quest.reward_points} />

        <div className="flex items-center gap-3 text-[11.5px] text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            ~{quest.effort_minutes} min
          </span>
          <EffortDots level={quest.effort_dots} />
          {slots === null ? <span>Unlimited slots</span> : slots > 0 ? <span>{slots} slots left</span> : <span className="text-neutral-400">Full</span>}
          {newToday && <span className="text-accent-400">New today</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-sm">
        <div className="text-[13.5px] font-medium">About this quest</div>
        <p className="text-[13px] leading-relaxed text-neutral-400">{quest.description}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-sm">
        <div className="text-[13.5px] font-medium">How to complete it</div>
        <ol className="flex flex-col gap-2">
          {quest.instructions.map((step: string, i: number) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-neutral-400">
              <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-accent-900 text-[11px] font-semibold text-accent-300">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-review-bg p-3.5 text-[12px] leading-relaxed text-review">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-none">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        After you submit, a reviewer checks your work within 24 hours. Points land
        in your wallet only when approved — track it under My work.
      </div>

      {mySubmission ? (
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-medium">Your submission</span>
            <StatusBadge status={mySubmission.status} kind="submission" />
          </div>
          <Link href="/work" className="text-[13px] text-accent-400">
            Track it under My work →
          </Link>
        </div>
      ) : attempt.ok ? (
        <Link
          href={`/quests/${quest.slug}/submit`}
          className="grid min-h-[48px] place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow"
        >
          Submit your proof
        </Link>
      ) : attempt.reason === "tier" ? (
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
          <Tag tone="neutral" className="self-start">
            Needs Tier {quest.min_tier}
          </Tag>
          <p className="text-[12.5px] leading-relaxed text-neutral-500">
            Complete your profile to unlock this quest — it only takes a couple
            of minutes.
          </p>
          <Link
            href="/profile"
            className="grid min-h-[48px] place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow"
          >
            Verify my profile
          </Link>
        </div>
      ) : (
        <div className="rounded-xl bg-surface p-4 text-center text-[13px] text-neutral-500 shadow-sm">
          This quest is currently full.
        </div>
      )}
    </div>
  );
}
