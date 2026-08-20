import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileForm } from "@/components/profile-form";
import { Tag, TierBadge } from "@/components/ui";
import { fmtPeso, fmtPts } from "@/lib/constants";
import { effectiveTier } from "@/lib/state";
import { manilaDayStartUTC } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) notFound();

  const admin = createAdminClient();
  const [{ data: ledger }, { data: submissions }, { data: verification }] = await Promise.all([
    admin.from("wallet_ledger").select("delta_points").eq("user_id", user.id),
    admin.from("submissions").select("status").eq("user_id", user.id),
    admin
      .from("verification_requests")
      .select("status, admin_note, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lifetimePts = (ledger ?? []).filter((r) => (r.delta_points ?? 0) > 0).reduce((s, r) => s + (r.delta_points ?? 0), 0);
  const subList = submissions ?? [];
  const approvedCount = subList.filter((s) => s.status === "approved").length;
  const approvalRate = subList.length ? Math.round((approvedCount / subList.length) * 100) : null;

  const tier = effectiveTier(profile);
  const suspended = profile.standing === "suspended";
  const restricted = profile.standing === "restricted";

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* H1/H2: standing banners — non-hostile, dated, actionable */}
      {suspended && (
        <div className="rounded-xl border border-bad/30 bg-bad-bg p-4 text-[12.5px] leading-relaxed text-bad">
          <b>Account suspended.</b> Your balance is held, not confiscated.
          We&apos;ve sent the details to your email.{" "}
          <a href="mailto:support@pisoquest.app" className="underline">Appeal</a> — we reply within 48h.
        </div>
      )}
      {restricted && (
        <div className="rounded-xl border border-warn/30 bg-warn-bg p-4 text-[12.5px] leading-relaxed text-warn">
          <b>Account restricted.</b> You can still earn, but cash-outs are paused
          until we sort this out. Balance is safe.{" "}
          <a href="mailto:support@pisoquest.app" className="underline">Contact us</a>.
        </div>
      )}

      {/* G1: header — lifetime ₱, approval rate, tier badge */}
      <section className="flex items-center gap-4 rounded-xl bg-surface p-4 shadow-sm">
        <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-accent-900 text-[22px] font-semibold text-accent-300">
          {(profile.full_name ?? profile.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold">
            {profile.full_name ?? "Ka-quest"}
          </div>
          <div className="truncate text-[11.5px] text-neutral-500">{profile.email}</div>
          <div className="mt-1 flex items-center gap-2">
            <TierBadge tier={tier} />
            <span className="text-[10.5px] text-neutral-500">code {profile.referral_code}</span>
          </div>
        </div>
      </section>

      {/* G1: stats */}
      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <div className="text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">
            Lifetime earnings
          </div>
          <div className="mt-1 text-[20px] font-semibold text-accent-300">{fmtPeso(lifetimePts / 100)}</div>
          <div className="text-[10.5px] text-neutral-500">{fmtPts(lifetimePts)} approved</div>
        </div>
        <div className="rounded-xl bg-surface p-4 shadow-sm">
          <div className="text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">
            Approval rate
          </div>
          <div className="mt-1 text-[20px] font-semibold">
            {approvalRate === null ? "—" : `${approvalRate}%`}
          </div>
          <div className="text-[10.5px] text-neutral-500">
            {approvedCount} of {subList.length} submissions
          </div>
        </div>
      </section>

      {/* G1: next-tier pitch */}
      {tier < 2 && (
        <section className="flex items-center justify-between gap-3 rounded-xl bg-section p-4 text-white shadow-sm">
          <div className="text-[12.5px] leading-relaxed text-white/90">
            {tier === 0 ? (
              <>Complete your profile to unlock <b>Tier 1</b> — cash out up to ₱500/day.</>
            ) : (
              <>Verify your ID to unlock <b>Tier 2</b> — ₱5,000/day + priority payout.</>
            )}
          </div>
          <Link
            href="/profile/verify"
            className="flex-none rounded-lg bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-section"
          >
            {tier === 0 ? "Complete" : "Verify"}
          </Link>
        </section>
      )}

      {/* Profile completion (Tier 0 only) */}
      {tier === 0 && !suspended && <ProfileForm />}

      {/* Verification status */}
      {verification && (
        <section className="flex items-center justify-between rounded-xl bg-surface p-4 text-[12.5px] shadow-sm">
          <span>
            ID verification:{" "}
            {verification.status === "pending" && <Tag tone="review">Under review</Tag>}
            {verification.status === "approved" && <Tag tone="ok">Approved</Tag>}
            {verification.status === "rejected" && <Tag tone="bad">Rejected</Tag>}
          </span>
          {verification.status === "rejected" && (
            <Link href="/profile/verify" className="text-accent-400">
              Retry →
            </Link>
          )}
        </section>
      )}

      <div className="flex flex-col gap-2">
        <Link href="/history" className="rounded-xl bg-surface p-3.5 text-center text-[13px] font-medium text-neutral-400 shadow-sm">
          Full history
        </Link>
        <Link href="/invite" className="rounded-xl bg-surface p-3.5 text-center text-[13px] font-medium text-accent-400 shadow-sm">
          Invite a kaibigan — earn ₱10 per friend
        </Link>
      </div>
    </div>
  );
}
