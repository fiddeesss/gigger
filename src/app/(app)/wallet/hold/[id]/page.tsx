import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtPts, fmtPeso } from "@/lib/constants";

export const dynamic = "force-dynamic";

// E5: the hold explains its own trigger and reframes as protection.
export default async function HoldPage({
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
  if (!r || r.status !== "on_hold") notFound();

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-warn-bg text-warn">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            <path d="M12 8v5" />
            <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
          </svg>
        </span>
        <div>
          <h1 className="text-[20px] font-semibold">Payout on hold</h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            {fmtPts(r.points)} ({fmtPeso(r.peso)}) · {r.reference_no}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 text-[13px] leading-relaxed shadow-sm">
        <p>
          <b>Why:</b> {r.hold_reason ?? "We need to double-check this payout."}
        </p>
        <p className="text-neutral-500">
          This is a safety step — it protects you and your balance. Your other
          earnings and quests are <b>not</b> affected.
        </p>
        <p className="text-neutral-500">
          Wasn&apos;t you who requested this? That&apos;s important —{" "}
          <a href="mailto:support@pisoquest.app" className="text-accent-400 underline">
            tell us right away
          </a>
          .
        </p>
      </div>

      <Link href="/wallet" className="text-center text-[13px] text-accent-400">
        ← Back to wallet
      </Link>
    </div>
  );
}
