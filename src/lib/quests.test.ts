import { describe, it, expect } from "vitest";
import {
  slotsLeft,
  isFull,
  ptsPerMinute,
  sortQuests,
  canAttempt,
  isNewToday,
} from "./quests";
import type { Quest } from "./types";

function q(overrides: Partial<Quest>): Quest {
  return {
    id: "q1",
    slug: "q1",
    title: "Q",
    description: "",
    category: "survey",
    reward_points: 100,
    proof_type: "survey",
    instructions: [],
    effort_minutes: 10,
    effort_dots: 1,
    min_tier: 0,
    slots_total: 10,
    slots_used: 3,
    status: "live",
    is_sponsored: false,
    starts_at: "2026-08-20T00:00:00Z",
    ends_at: null,
    created_by: null,
    created_at: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

describe("slots", () => {
  it("computes remaining slots", () => {
    expect(slotsLeft(q({}))).toBe(7);
    expect(slotsLeft(q({ slots_used: 10 }))).toBe(0);
    expect(isFull(q({ slots_used: 10 }))).toBe(true);
    expect(isFull(q({ slots_used: 9 }))).toBe(false);
  });
  it("null slots_total means unlimited", () => {
    expect(slotsLeft(q({ slots_total: null }))).toBe(null);
    expect(isFull(q({ slots_total: null }))).toBe(false);
  });
});

describe("sorting", () => {
  const a = q({ slug: "a", reward_points: 100, effort_minutes: 10, starts_at: "2026-08-01T00:00:00Z" }); // 10/min
  const b = q({ slug: "b", reward_points: 800, effort_minutes: 30, starts_at: "2026-08-03T00:00:00Z" }); // 26.7/min
  const c = q({ slug: "c", reward_points: 250, effort_minutes: 5, starts_at: "2026-08-02T00:00:00Z" }); // 50/min
  it("newest by start date", () => {
    expect(sortQuests([a, c, b], "newest").map((x) => x.slug)).toEqual(["b", "c", "a"]);
  });
  it("highest by reward", () => {
    expect(sortQuests([a, c, b], "highest").map((x) => x.slug)).toEqual(["b", "c", "a"]);
  });
  it("quickest by pts/min", () => {
    expect(sortQuests([a, b, c], "quickest").map((x) => x.slug)).toEqual(["c", "b", "a"]);
    expect(ptsPerMinute(c)).toBe(50);
  });
  it("does not mutate input", () => {
    const input = [c, a, b];
    sortQuests(input, "quickest");
    expect(input.map((x) => x.slug)).toEqual(["c", "a", "b"]);
  });
});

describe("canAttempt", () => {
  it("allows eligible user", () => {
    expect(canAttempt(q({}), { tier: 0 })).toEqual({ ok: true });
  });
  it("blocks below min tier", () => {
    expect(canAttempt(q({ min_tier: 1 }), { tier: 0 })).toEqual({ ok: false, reason: "tier" });
    expect(canAttempt(q({ min_tier: 2 }), { tier: 1, full_name: "J", mobile: "1" })).toEqual({
      ok: false,
      reason: "tier",
    });
    expect(canAttempt(q({ min_tier: 1 }), { tier: 2 })).toEqual({ ok: true });
  });
  it("blocks full and non-live quests", () => {
    expect(canAttempt(q({ slots_used: 10 }), { tier: 0 })).toEqual({ ok: false, reason: "full" });
    expect(canAttempt(q({ status: "paused" }), { tier: 0 })).toEqual({ ok: false, reason: "closed" });
  });
});

describe("isNewToday", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  it("flags quests started within 24h", () => {
    expect(isNewToday(q({ starts_at: "2026-08-20T00:00:00Z" }), now)).toBe(true);
    expect(isNewToday(q({ starts_at: "2026-08-19T13:00:00Z" }), now)).toBe(true);
    expect(isNewToday(q({ starts_at: "2026-08-18T00:00:00Z" }), now)).toBe(false);
    expect(isNewToday(q({ starts_at: null }), now)).toBe(false);
  });
});
