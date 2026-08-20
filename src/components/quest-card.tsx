import Link from "next/link";
import type { Quest, Submission } from "@/lib/types";
import { RewardLockup, Tag, EffortDots, StatusBadge } from "@/components/ui";
import {
  CATEGORY_LABELS,
  slotsLeft,
  isFull,
  isNewToday,
} from "@/lib/quests";

export function QuestCard({
  quest,
  mySubmission,
  minTierOk,
}: {
  quest: Quest;
  mySubmission?: Submission;
  minTierOk: boolean;
}) {
  const slots = slotsLeft(quest);
  const submitted = !!mySubmission;
  const full = isFull(quest);
  const newToday = isNewToday(quest);

  return (
    <Link
      href={`/quests/${quest.slug}`}
      className="flex flex-col gap-2.5 rounded-xl bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[14.5px] font-medium leading-snug">{quest.title}</div>
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
        {slots === null ? (
          <span>{full ? "Closed" : "Unlimited slots"}</span>
        ) : full ? (
          <span className="text-neutral-400">Full</span>
        ) : (
          <span>{slots} slots left</span>
        )}
        {newToday && <span className="text-accent-400">New today</span>}
      </div>

      <div className="flex items-center gap-1.5">
        {submitted && mySubmission && (
          <StatusBadge status={mySubmission.status} kind="submission" />
        )}
        {!minTierOk && !submitted && <Tag tone="neutral">Needs Tier {quest.min_tier}</Tag>}
      </div>
    </Link>
  );
}
