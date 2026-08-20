import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui";
import { fmtPts, fmtPeso } from "@/lib/constants";
import { normalizePhNumber } from "@/lib/redemptions";
import { timeAgo } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: r } = await supabase
    .from("redemptions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!r) notFound();

  const account = r.account as { number?: string; network?: string };
  const masked = account.number
    ? `•••• ${normalizePhNumber(account.number).slice(-4)}`
    : "—";

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface p-6 text-center shadow-lg">
        <span className="text-[10.5px] font-semibold uppercase tracking-widest text-neutral-500">
          Receipt
        </span>
        <div className="text-[30px] font-semibold text-accent-300">{fmtPts(r.points)}</div>
        <div className="text-lg font-medium">{fmtPeso(r.peso)}</div>
        <StatusBadge status={r.status} kind="redemption" />
        <div className="mt-1 flex flex-col gap-0.5 text-[12px] text-neutral-500">
          <span>
            {r.method.toUpperCase()}
            {account.network ? ` (${account.network})` : ""} · {masked}
          </span>
          <span>Reference: <b className="text-neutral-300">{r.reference_no}</b></span>
          <span>{timeAgo(r.created_at)}</span>
        </div>
        <div className="mt-2 w-full rounded-lg bg-neutral-900 px-3 py-2.5 text-[11px] text-neutral-500">
          Keep this reference number — it&apos;s your record for support and
          payout disputes.
        </div>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: "PisoQuest receipt", text: `${r.reference_no} · ${fmtPts(r.points)} (${fmtPeso(r.peso)}) via ${r.method.toUpperCase()}` });
            }
          }}
          className="grid min-h-[44px] w-full place-items-center rounded-lg bg-section text-[14px] font-medium text-white transition-colors hover:bg-section-glow"
        >
          Share this receipt
        </button>
      </div>

      {r.status === "on_hold" && (
        <Link
          href={`/wallet/hold/${r.id}`}
          className="rounded-xl bg-warn-bg px-4 py-3 text-[12.5px] text-warn"
        >
          This payout is on hold — see why →
        </Link>
      )}

      <div className="flex flex-col gap-2">
        <Link href="/wallet" className="text-center text-[13px] text-accent-400">
          ← Back to wallet
        </Link>
      </div>
    </div>
  );
}
