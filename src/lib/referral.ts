// Referral codes: 8 chars, "XXXX-XXXX", no ambiguous characters (0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  const rnd = new Uint32Array(8);
  crypto.getRandomValues(rnd);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[rnd[i] % ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

export function isValidReferralCode(code: string): boolean {
  // Same alphabet as the generator: no 0/O/1/I
  return /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code);
}
