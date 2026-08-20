// Pure state machines for the two money-critical lifecycles.
// Keep these side-effect free and exhaustively tested — the server actions
// that mutate the DB must route every transition through these functions.

// ---------- Submission review lifecycle ----------
// under_review → approved | rejected | flagged
// flagged      → approved | rejected (second review)

export type SubmissionStatus = "under_review" | "approved" | "rejected" | "flagged";
export type ReviewAction = "approve" | "reject" | "flag";

export function reviewSubmission(
  s: SubmissionStatus,
  a: ReviewAction,
): SubmissionStatus {
  switch (s) {
    case "under_review":
    case "flagged":
      if (a === "approve") return "approved";
      if (a === "reject") return "rejected";
      if (a === "flag" && s === "under_review") return "flagged";
      break;
  }
  throw new Error(`Cannot ${a} a ${s} submission`);
}

// ---------- Redemption / payout lifecycle ----------
// pending → paid_out | on_hold | rejected | cancelled (by user while pending)
// on_hold → paid_out | rejected

export type RedemptionStatus = "pending" | "on_hold" | "paid_out" | "rejected" | "cancelled";
export type PayoutAction = "pay" | "hold" | "reject";

export function payout(r: RedemptionStatus, a: PayoutAction): RedemptionStatus {
  if (r === "pending") {
    if (a === "pay") return "paid_out";
    if (a === "hold") return "on_hold";
    if (a === "reject") return "rejected";
  }
  if (r === "on_hold" && (a === "pay" || a === "reject")) {
    return a === "pay" ? "paid_out" : "rejected";
  }
  throw new Error(`Cannot ${a} a ${r} redemption`);
}

// ---------- Tiers ----------
// Tier 0 = email verified (earn only) · Tier 1 = profile complete · Tier 2 = ID verified
export type Tier = 0 | 1 | 2;

export interface ProfileLike {
  tier: number;
  full_name?: string | null;
  mobile?: string | null;
}

export function effectiveTier(p: ProfileLike): Tier {
  // Stored tier is authoritative once set (admin-verified or auto-promoted).
  if (p.tier >= 1) return p.tier >= 2 ? 2 : 1;
  // Tier 0 auto-promotes in display when the profile becomes complete;
  // the app persists tier=1 in the profile-update action.
  const complete = Boolean(p.full_name?.trim()) && Boolean(p.mobile?.trim());
  return complete ? 1 : 0;
}

// ---------- Proof of submission status ----------
export const SUBMISSION_STATUS_META: Record<
  SubmissionStatus,
  { label: string; tone: "review" | "ok" | "bad" | "warn" | "neutral" }
> = {
  under_review: { label: "Under Review", tone: "review" },
  flagged: { label: "Flagged — extra review", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "bad" },
};

export const REDEMPTION_STATUS_META: Record<
  RedemptionStatus,
  { label: string; tone: "review" | "ok" | "bad" | "warn" | "neutral" }
> = {
  pending: { label: "Pending", tone: "review" },
  on_hold: { label: "On Hold", tone: "warn" },
  paid_out: { label: "Paid Out", tone: "ok" },
  rejected: { label: "Rejected", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
