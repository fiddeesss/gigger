// PisoQuest business rules — single source of truth.
// These are the product's non-negotiable numbers (see implementation plan §2).

export const APP_NAME = "PisoQuest";
export const PTS_PER_PESO = 100; // the rate is the brand: 100 pts = ₱1, always

/** Daily redemption cap in ₱ per tier. Tier 0 cannot redeem at all. */
export const TIER_CAPS: Record<number, number> = { 1: 500, 2: 5000 };

/** Minimum redemption in ₱ per payout rail. */
export const REDEEM_MINS: Record<string, number> = { gcash: 100, maya: 100, load: 10 };

export const REVIEW_SLA_HOURS = 24;
export const FLAG_SLA_HOURS = 72;

export const INVITE_BONUS = 1000; // pts, credited to BOTH sides (₱10 each)
export const INVITE_MONTHLY_CAP = 10; // bonus-earning invites per month per inviter

export const PROOF_TYPES = ["photo", "video", "text", "poll", "survey", "labels"] as const;
export const QUEST_CATEGORIES = [
  "survey",
  "data_labeling",
  "social_ugc",
  "poll",
  "video_review",
  "photo_task",
] as const;

export function ptsToPeso(pts: number): number {
  return pts / PTS_PER_PESO;
}

export function fmtPts(pts: number): string {
  return `${pts.toLocaleString("en-PH")} pts`;
}

export function fmtPeso(peso: number): string {
  return `₱${peso.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtPtsPeso(pts: number): string {
  return `${fmtPts(pts)} = ${fmtPeso(ptsToPeso(pts))}`;
}
