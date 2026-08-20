import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RedeemForm } from "@/components/redeem-form";
import { manilaDayStartUTC } from "@/lib/dates";
import { TIER_CAPS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function RedeemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: ledger }, { data: redemptions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("wallet_ledger").select("delta_points").eq("user_id", user.id),
    supabase
      .from("redemptions")
      .select("points, peso, status, created_at")
      .eq("user_id", user.id),
  ]);

  const totalPts = (ledger ?? []).reduce((s, r) => s + (r.delta_points ?? 0), 0);
  const pendingPts = (redemptions ?? [])
    .filter((r) => r.status === "pending" || r.status === "on_hold")
    .reduce((s, r) => s + r.points, 0);
  const spendablePts = Math.max(0, totalPts - pendingPts);

  const dayStart = new Date(manilaDayStartUTC()).toISOString();
  const spentTodayPts = (redemptions ?? [])
    .filter(
      (r) =>
        (r.status === "pending" || r.status === "on_hold" || r.status === "paid_out") &&
        r.created_at >= dayStart,
    )
    .reduce((s, r) => s + r.points, 0);

  const tier = profile?.tier ?? 0;
  const capPts = TIER_CAPS[tier] ? TIER_CAPS[tier] * 100 : 0;

  if (tier < 1) {
    redirect("/wallet"); // the wallet card explains the Tier 1 lock
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="text-[18px] font-semibold">Redeem points</h1>
      <RedeemForm
        tier={tier}
        spendablePts={spendablePts}
        spentTodayPts={spentTodayPts}
        capPts={capPts}
      />
    </div>
  );
}
