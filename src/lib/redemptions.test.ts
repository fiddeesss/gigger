import { describe, it, expect } from "vitest";
import {
  normalizePhNumber,
  isValidPhNumber,
  validateRedeem,
  REDEEM_PRESETS,
} from "./redemptions";

describe("PH number normalization", () => {
  it("normalizes +63/63 prefixes to 09", () => {
    expect(normalizePhNumber("+63 917 555 0143")).toBe("09175550143");
    expect(normalizePhNumber("639175550143")).toBe("09175550143");
    expect(normalizePhNumber("0917 555 0143")).toBe("09175550143");
  });
  it("validates 11-digit 09 numbers", () => {
    expect(isValidPhNumber("09175550143")).toBe(true);
    expect(isValidPhNumber("+639175550143")).toBe(true);
    expect(isValidPhNumber("0917555014")).toBe(false); // too short
    expect(isValidPhNumber("19175550143")).toBe(false); // wrong prefix
    expect(isValidPhNumber("091755501431")).toBe(false); // too long
  });
});

describe("validateRedeem", () => {
  const base = { method: "gcash" as const, number: "09175550143" };
  it("tier 0 cannot redeem", () => {
    expect(validateRedeem({ ...base, points: 10000 }, 0, 10000, 0, 50000).ok).toBe(false);
  });
  it("respects balance", () => {
    expect(validateRedeem({ ...base, points: 20000 }, 1, 10000, 0, 50000).ok).toBe(false);
  });
  it("respects method minimums", () => {
    expect(validateRedeem({ ...base, points: 5000 }, 1, 10000, 0, 50000).ok).toBe(false); // ₱50 < ₱100
    expect(
      validateRedeem({ ...base, method: "load", network: "globe", points: 1000 }, 1, 10000, 0, 50000).ok,
    ).toBe(true); // ₱10 ok
  });
  it("respects daily cap", () => {
    expect(validateRedeem({ ...base, points: 40000 }, 1, 100000, 30000, 50000).ok).toBe(false);
    expect(validateRedeem({ ...base, points: 20000 }, 1, 100000, 30000, 50000).ok).toBe(true);
  });
  it("rejects bad numbers and missing network", () => {
    expect(validateRedeem({ ...base, number: "123", points: 10000 }, 1, 10000, 0, 50000).ok).toBe(false);
    expect(validateRedeem({ ...base, method: "load", points: 1000 }, 1, 10000, 0, 50000).ok).toBe(false);
  });
  it("presets are sane", () => {
    expect(REDEEM_PRESETS).toEqual([100, 200, 500, 1000]);
  });
});
