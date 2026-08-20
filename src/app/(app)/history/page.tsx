import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtPts, fmtPeso } from "@/lib/constants";
import { timeAgo } from "@/lib/dates";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

interface HistoryRow {
  id: string;
  when: string;
  label: string;
  pts: number; // signed; rejected redemptions show +0
  peso: number | null;
  status?: "paid_out" | "rejected" | "cancelled" | "pending" | "on_hold";
}

// F1: one ledger, every row pts + ₱ + a status pill. Rejected rows show +0
// explicitly rather than disappearing — the record is complete and auditable.
export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [ledgerRes, redemptionsRes] = await Promise.all([
    supabase
      .from("wallet_ledger")
      .select("id, delta_points, kind, note, ref_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("redemptions")
      .select("id, reference_no, points, peso, method, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const rows: HistoryRow[] = [
    ...(ledgerRes.data ?? []).map((l) => ({
      id: `l-${l.id}`,
      when: l.created_at,
      label: (l.note as string) ?? l.kind,
      pts: l.delta_points ?? 0,
      peso: (l.delta_points ?? 0) / 100,
    })),
    // Rejected/cancelled redemptions have no ledger row — show them as +0
    ...(redemptionsRes.data ?? [])
      .filter((r) => r.status === "rejected" || r.status === "cancelled")
      .map((r) => ({
        id: `r-${r.id}`,
        when: r.created_at,
        label: `Redemption ${r.reference_no} (${r.method.toUpperCase()}) — not paid`,
        pts: 0,
        peso: null,
        status: r.status as HistoryRow["status"],
      })),
  ]
    .sort((a, b) => Date.parse(b.when) - Date.parse(a.when))
    .slice(0, 100);

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-semibold">History</h1>
        <Link href="/wallet" className="text-[12.5px] text-accent-400">
          ← Wallet
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-surface p-8 text-center text-[13px] text-neutral-500 shadow-sm">
          No transactions yet — complete a quest to see your first entry.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-3 shadow-sm">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[12.5px] font-medium">{row.label}</span>
                <span className="text-[10.5px] text-neutral-500">{timeAgo(row.when)}</span>
              </div>
              <div className="flex flex-none items-center gap-2">
                {row.status ? (
                  <StatusBadge status={row.status} kind="redemption" />
                ) : null}
                <span
                  className={`text-[13px] font-semibold ${
                    row.pts > 0 ? "text-accent-300" : row.pts < 0 ? "text-bad" : "text-neutral-500"
                  }`}
                >
                  {row.pts > 0 ? "+" : ""}
                  {fmtPts(row.pts)}
                </span>
                {row.peso !== null && (
                  <span className="w-16 text-right text-[11.5px] text-neutral-500">
                    {row.pts > 0 ? "" : "−"}
                    {fmtPeso(Math.abs(row.peso))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
