// DB row shapes (public schema — see supabase/migrations/0001_init.sql)

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  mobile: string | null;
  tier: number;
  standing: "good_standing" | "restricted" | "suspended";
  referral_code: string;
  referred_by: string | null;
  is_admin: boolean;
  created_at: string;
}

export type QuestCategory =
  | "survey"
  | "data_labeling"
  | "social_ugc"
  | "poll"
  | "video_review"
  | "photo_task";

export type QuestStatus = "draft" | "live" | "paused" | "closed";
export type ProofType = "photo" | "video" | "text" | "poll" | "survey" | "labels";

export interface Quest {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: QuestCategory;
  reward_points: number;
  proof_type: ProofType;
  instructions: string[];
  options: string[]; // poll choices (proof_type='poll')
  questions: { q: string; type: "single" | "text"; options?: string[] }[]; // survey (proof_type='survey')
  effort_minutes: number;
  effort_dots: number;
  min_tier: number;
  slots_total: number | null;
  slots_used: number;
  status: QuestStatus;
  is_sponsored: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type SubmissionStatus =
  | "under_review"
  | "approved"
  | "rejected"
  | "flagged";

export interface Submission {
  id: string;
  quest_id: string;
  user_id: string;
  payload: Record<string, unknown>;
  status: SubmissionStatus;
  flags: { signal?: string; note?: string }[];
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  points_awarded: number | null;
  created_at: string;
}

export type RedemptionMethod = "gcash" | "maya" | "load";
export type RedemptionStatus =
  | "pending"
  | "on_hold"
  | "paid_out"
  | "rejected"
  | "cancelled";

export interface Redemption {
  id: string;
  user_id: string;
  points: number;
  peso: number;
  method: RedemptionMethod;
  account: Record<string, string>;
  status: RedemptionStatus;
  reference_no: string;
  hold_reason: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  paid_out_at: string | null;
  created_at: string;
}

export interface WalletLedgerRow {
  id: string;
  user_id: string;
  delta_points: number;
  kind: "quest_reward" | "invite_bonus" | "redemption" | "adjustment" | "refund";
  ref_id: string | null;
  note: string | null;
  created_at: string;
}
