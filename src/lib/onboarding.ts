import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidReferralCode } from "@/lib/referral";

export type ReferralResult = { ok: boolean; reason?: string };

/**
 * Attach a referral to a user. Safe to call more than once (no-op after first).
 * Rules (design I2): bonus only fires on the invitee's FIRST APPROVED quest,
 * so here we only record attribution + the invite row. Self-invite is blocked.
 */
export async function applyReferral(
  userId: string,
  userEmail: string,
  rawRef: string | null,
): Promise<ReferralResult> {
  if (!rawRef) return { ok: false, reason: "no-ref" };
  const code = rawRef.trim().toUpperCase();
  if (!isValidReferralCode(code)) return { ok: false, reason: "invalid-code" };

  const admin = createAdminClient();

  // Already attributed?
  const { data: me } = await admin
    .from("profiles")
    .select("referred_by")
    .eq("id", userId)
    .single();
  if (!me || me.referred_by) return { ok: false, reason: "already-attributed" };

  // Inviter must exist and must not be the invitee.
  const { data: inviter } = await admin
    .from("profiles")
    .select("id, email")
    .eq("referral_code", code)
    .single();
  if (!inviter) return { ok: false, reason: "unknown-code" };
  if (inviter.id === userId || inviter.email?.toLowerCase() === userEmail.toLowerCase()) {
    return { ok: false, reason: "self-invite" };
  }

  // Attribute + record the invite (status: joined). The unique index on
  // (inviter_id, invitee_id) makes concurrent duplicate calls safe.
  const { error: updateError } = await admin
    .from("profiles")
    .update({ referred_by: inviter.id })
    .eq("id", userId);
  if (updateError) return { ok: false, reason: "db-error" };

  const { error: insertError } = await admin
    .from("invites")
    .upsert(
      {
        inviter_id: inviter.id,
        invitee_id: userId,
        code,
        status: "joined",
      },
      { onConflict: "inviter_id,invitee_id", ignoreDuplicates: true },
    );
  if (insertError) return { ok: false, reason: "db-error" };

  return { ok: true };
}
