import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VerifyForm } from "@/components/verify-form";
import { TierBadge, Tag } from "@/components/ui";
import { effectiveTier } from "@/lib/state";

export const dynamic = "force-dynamic";

const ID_TYPES = ["PhilSys National ID", "Driver's License", "Passport", "UMID", "PRC ID", "Postal ID"];

export default async function VerifyPage() {
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
  const { data: latest } = await admin
    .from("verification_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tier = effectiveTier(profile);
  if (tier >= 2) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6 text-center">
        <span className="mx-auto grid h-[60px] w-[60px] place-items-center rounded-full bg-ok-bg text-ok">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
        </span>
        <div>
          <h1 className="text-[20px] font-semibold">You&apos;re Tier 2</h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            Cash out up to ₱5,000/day with priority payout. Your badge follows
            you across the app.
          </p>
        </div>
        <TierBadge tier={2} />
        <Link href="/profile" className="text-[13px] text-accent-400">
          ← Back to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <Link href="/profile" className="text-[13px] text-neutral-500">
        ← Profile
      </Link>
      <h1 className="text-[18px] font-semibold">Verification</h1>

      {/* G2: ladder — completed tiers as receipts */}
      <section className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px]">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-ok-bg text-[10px] text-ok">✓</span>
            Tier 0 · Starter
          </span>
          <Tag tone="ok">Done</Tag>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px]">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-ok-bg text-[10px] text-ok">✓</span>
            Tier 1 · Profile complete
          </span>
          <Tag tone={tier >= 1 ? "ok" : "neutral"}>{tier >= 1 ? "Done" : "Complete on profile"}</Tag>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px]">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-900 text-[10px] text-accent-300">2</span>
            Tier 2 · ID verified
          </span>
          {latest?.status === "pending" ? (
            <Tag tone="review">Under review</Tag>
          ) : latest?.status === "rejected" ? (
            <Tag tone="bad">Rejected</Tag>
          ) : (
            <Tag tone="neutral">Locked</Tag>
          )}
        </div>
      </section>

      {/* Privacy reassurance FIRST (G2) */}
      <p className="rounded-xl bg-review-bg px-4 py-3 text-[12px] leading-relaxed text-review">
        🔒 Your ID and selfie are encrypted, seen only by our verification team,
        and deleted after review. We never share them.
      </p>

      {latest?.status === "pending" ? (
        <div className="rounded-xl bg-surface p-6 text-center text-[13px] text-neutral-500 shadow-sm">
          <b className="text-neutral-300">Under review.</b> Usually within 48h.
          Keep questing in the meantime — Tier 1 already works for cash-outs.
          <Link href="/quests" className="mt-3 block text-[13px] font-medium text-accent-400">
            Browse quests →
          </Link>
        </div>
      ) : (
        <>
          {latest?.status === "rejected" && (
            <p className="rounded-xl bg-bad-bg px-4 py-3 text-[12px] text-bad">
              <b>Rejected:</b> {latest.admin_note ?? "Retake clearer photos and try again."}
            </p>
          )}
          <VerifyForm
            userId={user.id}
            idTypes={ID_TYPES}
            rejectedNote={latest?.status === "rejected" ? latest.admin_note : null}
          />
        </>
      )}
    </div>
  );
}
