import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/ui";
import { fmtPts, fmtPeso } from "@/lib/constants";
import { manilaDayStartUTC } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: ledger }, { data: redemptions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("wallet_ledger").select("delta_points").eq("user_id", user.id),
    supabase
      .from("redemptions")
      .select("id, points, peso, method, reference_no, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const totalPts = (ledger ?? []).reduce((s, r) => s + (r.delta_points ?? 0), 0);
  const pendingPts = (redemptions ?? [])
    .filter((r) => r.status === "pending" || r.status === "on_hold")
    .reduce((s, r) => s + r.points, 0);
  const spendablePts = Math.max(0, totalPts - pendingPts);
  const canRedeem = (profile?.tier ?? 0) >= 1 && profile?.standing !== "suspended";

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* E1: the one saturated surface — the money card */}
      <section className="rounded-2xl bg-section p-5 text-white shadow-lg">
        <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">
          Balance
        </div>
        <div className="mt-1 text-[30px] font-semibold leading-none">{fmtPts(totalPts)}</div>
        <div className="mt-1 text-sm text-white/80">{fmtPeso(totalPts / 100)}</div>

        {pendingPts > 0 && (
          <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-[11.5px] text-white/80">
            {fmtPts(pendingPts)} pending — not part of your balance until paid
          </div>
        )}

        {canRedeem ? (
          <Link
            href="/wallet/redeem"
            className="mt-4 grid min-h-[44px] place-items-center rounded-lg bg-white text-[14px] font-semibold text-section transition-opacity hover:opacity-90"
          >
            Redeem · {fmtPeso(spendablePts / 100)} available
          </Link>
        ) : (
          <div className="mt-4 rounded-lg bg-white/10 px-3.5 py-3 text-[12px] leading-relaxed text-white/85">
            {profile?.standing === "suspended" ? (
              <>Your balance is safe and held while your account is under review.</>
            ) : (
              <>
                Earning is unlocked — cash-out needs <b>Tier 1</b> (complete your
                profile). It only takes 2 minutes.
              </>
            )}
          </div>
        )}
        <p className="mt-3 text-[10.5px] text-white/60">
          Fixed rate: 100 pts = ₱1, always. No fees, ever.
        </p>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">Recent activity</h2>
        <Link href="/history" className="text-[12.5px] text-accent-400">
          Full history →
        </Link>
      </div>

      {!redemptions?.length && (ledger ?? []).length === 0 ? (
        <div className="rounded-xl bg-surface p-6 text-center text-[12.5px] text-neutral-500 shadow-sm">
          Your points and payouts will show up here.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...(redemptions ?? [])].slice(0, 5).map((r) => (
            <li key={r.id}>
              <Link
                href={r.status === "on_hold" ? `/wallet/hold/${r.id}` : `/wallet/receipt/${r.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3.5 shadow-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-medium">{r.reference_no}</span>
                  <span className="text-[11px] text-neutral-500">
                    {r.method.toUpperCase()} · {fmtPeso(r.peso)}
                  </span>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <span className="text-[12px] text-bad">−{fmtPts(r.points)}</span>
                  <StatusBadge status={r.status} kind="redemption" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
