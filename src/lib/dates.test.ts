import { describe, it, expect } from "vitest";
import { formatDeadline, manilaDayStartUTC, isTodayUTC } from "./dates";

const NOW = Date.parse("2026-08-20T12:00:00Z"); // 8:00 PM Manila, Thursday

describe("formatDeadline (Manila time)", () => {
  it("renders 'by tomorrow HH:MM AM/PM' for +24h", () => {
    const deadline = NOW + 24 * 3600 * 1000; // 8:00 PM Manila Friday
    expect(formatDeadline(deadline, NOW)).toBe("by tomorrow 8:00 PM");
  });
  it("labels same-day deadlines as today", () => {
    // NOW = 8:00 PM Manila Thu; +2h = 10:00 PM Manila Thu
    expect(formatDeadline(NOW + 2 * 3600 * 1000, NOW)).toBe("by today 10:00 PM");
  });
  it("uses Manila not UTC (UTC+8 no DST)", () => {
    // 2026-08-20T02:19:00Z = 10:19 AM Manila — same Manila day as NOW
    expect(formatDeadline(Date.parse("2026-08-20T02:19:00Z"), NOW)).toBe("by today 10:19 AM");
  });
  it("crosses midnight correctly", () => {
    // 2026-08-20T16:30:00Z = 12:30 AM Manila Fri — one Manila day past Thu
    expect(formatDeadline(Date.parse("2026-08-20T16:30:00Z"), NOW)).toBe("by tomorrow 12:30 AM");
  });
});

describe("manila day boundary", () => {
  it("starts at 16:00 UTC the previous day", () => {
    const start = manilaDayStartUTC(NOW);
    const manila = new Date(start + 8 * 3600 * 1000);
    expect(manila.getUTCHours()).toBe(0);
    expect(manila.getUTCMinutes()).toBe(0);
    // NOW (Aug 20 12:00Z = Aug 20 20:00 Manila) → day started Aug 19 16:00Z
    expect(start).toBe(Date.parse("2026-08-19T16:00:00Z"));
  });
  it("isTodayUTC respects the Manila boundary", () => {
    // Aug 20 15:59:59Z = Aug 20 23:59:59 Manila → today
    expect(isTodayUTC("2026-08-20T15:59:59Z", NOW)).toBe(true);
    // Aug 20 16:00:00Z = Aug 21 00:00 Manila → NOT today
    expect(isTodayUTC("2026-08-20T16:00:00Z", NOW)).toBe(false);
  });
});
