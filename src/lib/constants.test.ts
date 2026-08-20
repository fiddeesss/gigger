import { describe, it, expect } from "vitest";
import { ptsToPeso, fmtPts, fmtPeso, fmtPtsPeso, PTS_PER_PESO } from "./constants";
import { generateReferralCode, isValidReferralCode } from "./referral";

describe("points ↔ peso", () => {
  it("100 pts = ₱1.00", () => {
    expect(ptsToPeso(100)).toBe(1);
    expect(ptsToPeso(250)).toBe(2.5);
    expect(ptsToPeso(1000)).toBe(10);
  });
  it("formats lockups", () => {
    expect(fmtPts(250)).toBe("250 pts");
    expect(fmtPeso(2.5)).toBe("₱2.50");
    expect(fmtPtsPeso(1000)).toBe("1,000 pts = ₱10.00");
  });
  it("rate constant is 100", () => {
    expect(PTS_PER_PESO).toBe(100);
  });
});

describe("referral codes", () => {
  it("generates XXXX-XXXX shape without ambiguous chars", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode();
      expect(isValidReferralCode(code)).toBe(true);
      expect(code).not.toMatch(/[01IO]/);
    }
  });
  it("rejects malformed codes", () => {
    expect(isValidReferralCode("")).toBe(false);
    expect(isValidReferralCode("KAI-7F3Q-extra")).toBe(false);
    expect(isValidReferralCode("ka i-7f3q")).toBe(false);
    expect(isValidReferralCode("KA17F3Q")).toBe(false);
    expect(isValidReferralCode("KAII-7F3Q")).toBe(false); // no I
  });
});
