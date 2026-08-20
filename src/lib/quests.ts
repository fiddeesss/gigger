import type { Quest } from "@/lib/types";
import { effectiveTier, type ProfileLike } from "@/lib/state";

export type QuestSort = "newest" | "highest" | "quickest";

export const CATEGORY_LABELS: Record<string, string> = {
  survey: "Survey",
  data_labeling: "Data labeling",
  social_ugc: "Social / UGC",
  poll: "Poll",
  video_review: "Video review",
  photo_task: "Photo task",
};

export function slotsLeft(q: Quest): number | null {
  if (q.slots_total === null) return null; // unlimited
  return Math.max(0, q.slots_total - q.slots_used);
}

export function isFull(q: Quest): boolean {
  return slotsLeft(q) === 0;
}

export function ptsPerMinute(q: Quest): number {
  return q.effort_minutes > 0 ? q.reward_points / q.effort_minutes : q.reward_points;
}

export function sortQuests(quests: Quest[], sort: QuestSort): Quest[] {
  const copy = [...quests];
  switch (sort) {
    case "highest":
      return copy.sort((a, b) => b.reward_points - a.reward_points);
    case "quickest":
      return copy.sort((a, b) => ptsPerMinute(b) - ptsPerMinute(a));
    case "newest":
    default:
      return copy.sort(
        (a, b) => Date.parse(b.starts_at ?? b.created_at) - Date.parse(a.starts_at ?? a.created_at),
      );
  }
}

/** Can this user attempt this quest? Tier gate + capacity. */
export function canAttempt(q: Quest, profile: ProfileLike): {
  ok: boolean;
  reason?: "tier" | "full" | "closed";
} {
  if (q.status !== "live") return { ok: false, reason: "closed" };
  if (isFull(q)) return { ok: false, reason: "full" };
  if (effectiveTier(profile) < q.min_tier) return { ok: false, reason: "tier" };
  return { ok: true };
}

export function isNewToday(q: Quest, now: Date = new Date()): boolean {
  if (!q.starts_at) return false;
  const start = new Date(q.starts_at);
  const dayAgo = now.getTime() - 24 * 3600 * 1000;
  return start.getTime() > dayAgo && start.getTime() <= now.getTime();
}
