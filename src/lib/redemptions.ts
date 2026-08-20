// Client-side redemption validation — mirrors the RPC's rules so users get
// inline feedback before hitting the database. The RPC is the source of truth.

export type PayoutMethod = "gcash" | "maya" | "load";
export type LoadNetwork = "globe" | "smart" | "tnt" | "ditto" | "sun";

export const REDEEM_PRESETS = [100, 200, 500, 1000]; // ₱ presets

export function normalizePhNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

export function isValidPhNumber(raw: string): boolean {
  return /^09\d{9}$/.test(normalizePhNumber(raw));
}

export interface RedeemInput {
  method: PayoutMethod;
  points: number;
  number: string;
  network?: LoadNetwork;
}

export function validateRedeem(
  input: RedeemInput,
  tier: number,
  spendablePts: number,
  spentTodayPts: number,
  capPts: number,
): { ok: boolean; reason?: string } {
  if (tier < 1) return { ok: false, reason: "Cash-out needs Tier 1" };
  if (input.points <= 0 || input.points % 10 !== 0)
    return { ok: false, reason: "Enter a valid amount (multiples of 10 pts)" };
  if (input.points > spendablePts) return { ok: false, reason: "Not enough balance" };

  const peso = input.points / 100;
  const min = input.method === "load" ? 10 : 100;
  if (peso < min) return { ok: false, reason: `Minimum is ₱${min} for ${input.method}` };
  if (spentTodayPts + input.points > capPts)
    return { ok: false, reason: "Daily cap reached" };

  if (!isValidPhNumber(input.number)) return { ok: false, reason: "Enter a valid PH mobile number" };
  if (input.method === "load" && !input.network) return { ok: false, reason: "Pick a network" };
  return { ok: true };
}

export const METHOD_LABELS: Record<PayoutMethod, string> = {
  gcash: "GCash",
  maya: "Maya",
  load: "Prepaid load",
};

export const NETWORK_LABELS: Record<LoadNetwork, string> = {
  globe: "Globe",
  smart: "Smart",
  tnt: "TNT",
  ditto: "DITO",
  sun: "Sun",
};
