import { describe, it, expect } from "vitest";
import {
  reviewSubmission,
  payout,
  effectiveTier,
  SUBMISSION_STATUS_META,
  REDEMPTION_STATUS_META,
} from "./state";

describe("reviewSubmission — submission lifecycle", () => {
  it("under_review → approved on approve", () => {
    expect(reviewSubmission("under_review", "approve")).toBe("approved");
  });
  it("under_review → rejected on reject", () => {
    expect(reviewSubmission("under_review", "reject")).toBe("rejected");
  });
  it("under_review → flagged on flag", () => {
    expect(reviewSubmission("under_review", "flag")).toBe("flagged");
  });
  it("flagged → approved on second-review approve", () => {
    expect(reviewSubmission("flagged", "approve")).toBe("approved");
  });
  it("flagged → rejected on second-review reject", () => {
    expect(reviewSubmission("flagged", "reject")).toBe("rejected");
  });
  it("rejects illegal transitions", () => {
    expect(() => reviewSubmission("approved", "reject")).toThrow();
    expect(() => reviewSubmission("rejected", "approve")).toThrow();
    expect(() => reviewSubmission("approved", "flag")).toThrow();
    expect(() => reviewSubmission("flagged", "flag")).toThrow(); // no double-flag
  });
});

describe("payout — redemption lifecycle", () => {
  it("pending → paid_out / on_hold / rejected / cancelled", () => {
    expect(payout("pending", "pay")).toBe("paid_out");
    expect(payout("pending", "hold")).toBe("on_hold");
    expect(payout("pending", "reject")).toBe("rejected");
  });
  it("on_hold → paid_out or rejected only", () => {
    expect(payout("on_hold", "pay")).toBe("paid_out");
    expect(payout("on_hold", "reject")).toBe("rejected");
    expect(() => payout("on_hold", "hold")).toThrow();
  });
  it("terminal states are locked", () => {
    expect(() => payout("paid_out", "reject")).toThrow();
    expect(() => payout("paid_out", "pay")).toThrow();
    expect(() => payout("rejected", "pay")).toThrow();
  });
});

describe("effectiveTier", () => {
  it("tier 2 stays 2 regardless of profile completeness", () => {
    expect(effectiveTier({ tier: 2 })).toBe(2);
    expect(effectiveTier({ tier: 2, full_name: null, mobile: null })).toBe(2);
  });
  it("tier 1 requires full_name + mobile", () => {
    expect(effectiveTier({ tier: 0, full_name: "Juan", mobile: "0917..." })).toBe(1);
    expect(effectiveTier({ tier: 0, full_name: "Juan" })).toBe(0);
    expect(effectiveTier({ tier: 0, mobile: "0917" })).toBe(0);
    expect(effectiveTier({ tier: 0 })).toBe(0);
  });
  it("stored tier 1 persists", () => {
    expect(effectiveTier({ tier: 1, full_name: null, mobile: null })).toBe(1);
  });
});

describe("status meta — every state has copy", () => {
  it("covers all submission states", () => {
    for (const s of ["under_review", "approved", "rejected", "flagged"]) {
      expect(SUBMISSION_STATUS_META[s as keyof typeof SUBMISSION_STATUS_META]).toBeDefined();
    }
  });
  it("covers all redemption states", () => {
    for (const s of ["pending", "on_hold", "paid_out", "rejected", "cancelled"]) {
      expect(REDEMPTION_STATUS_META[s as keyof typeof REDEMPTION_STATUS_META]).toBeDefined();
    }
  });
});
