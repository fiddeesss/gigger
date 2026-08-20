import { createAdminClient } from "@/lib/supabase/admin";
import { PayoutQueue } from "@/components/payout-queue";

export const dynamic = "force-dynamic";

export default async function AdminRedemptionsPage() {
  const admin = createAdminClient();
  const { data: redemptions } = await admin
    .from("redemptions")
    .select("id, reference_no, points, peso, method, account, status, hold_reason, created_at, user_id")
    .in("status", ["pending", "on_hold"])
    .order("created_at", { ascending: true });

  const userIds = [...new Set((redemptions ?? []).map((r) => r.user_id))];
  const { data: users } = await admin
    .from("profiles")
    .select("id, full_name, email, tier")
    .in("id", userIds);
  const userById = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  const rows = (redemptions ?? []).map((r) => ({
    id: r.id,
    reference_no: r.reference_no,
    points: r.points,
    peso: Number(r.peso),
    method: r.method,
    account: (r.account ?? {}) as { number?: string; network?: string },
    status: r.status as "pending" | "on_hold",
    hold_reason: r.hold_reason,
    created_at: r.created_at,
    user: userById[r.user_id] ?? { full_name: null, email: "unknown", tier: 0 },
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Payout queue</h1>
        <span className="text-xs text-neutral-500">
          {rows.length} pending · pay out-of-band, then mark Paid
        </span>
      </div>
      <PayoutQueue rows={rows} />
    </div>
  );
}
