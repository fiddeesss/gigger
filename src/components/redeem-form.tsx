"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  validateRedeem,
  normalizePhNumber,
  REDEEM_PRESETS,
  METHOD_LABELS,
  NETWORK_LABELS,
  type PayoutMethod,
  type LoadNetwork,
} from "@/lib/redemptions";
import { fmtPts, fmtPeso } from "@/lib/constants";
import { cn } from "@/lib/cn";

export function RedeemForm({
  tier,
  spendablePts,
  spentTodayPts,
  capPts,
}: {
  tier: number;
  spendablePts: number;
  spentTodayPts: number;
  capPts: number;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PayoutMethod>("gcash");
  const [peso, setPeso] = useState<number>(100);
  const [custom, setCustom] = useState("");
  const [number, setNumber] = useState("");
  const [network, setNetwork] = useState<LoadNetwork>("globe");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const points = Math.round(peso * 100);
  const spendablePeso = spendablePts / 100;
  const spentTodayPeso = spentTodayPts / 100;
  const capPeso = capPts / 100;
  const capPct = Math.min(100, (spentTodayPeso / capPeso) * 100);

  const validation = validateRedeem(
    { method, points, number, network: method === "load" ? network : undefined },
    tier,
    spendablePts,
    spentTodayPts,
    capPts,
  );

  const masked = useMemo(() => {
    const n = normalizePhNumber(number);
    return n.length >= 4 ? `•••• ${n.slice(-4)}` : "";
  }, [number]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !validation.ok) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const account =
      method === "load"
        ? { number: normalizePhNumber(number), network }
        : { number: normalizePhNumber(number) };
    const { data, error } = await supabase.rpc("create_redemption", {
      p_user_id: (await supabase.auth.getUser()).data.user?.id,
      p_points: points,
      p_method: method,
      p_account: account,
    });
    if (error) {
      setError("Couldn't submit — check your connection and try again.");
      setBusy(false);
      return;
    }
    const res = data as { ok: boolean; reason?: string; redemption_id?: string };
    if (!res.ok) {
      setError(
        res.reason === "daily-cap"
          ? "Daily cap reached — try again tomorrow."
          : res.reason === "insufficient"
            ? "Not enough balance (pending redemptions count against it)."
            : res.reason === "below-minimum"
              ? "Below the minimum for this payout method."
              : res.reason === "tier"
                ? "Cash-out needs Tier 1."
                : "Couldn't redeem right now. Try again.",
      );
      setBusy(false);
      return;
    }
    router.push(`/wallet/receipt/${res.redemption_id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* E2: cap meter BEFORE the amount step — never discover a limit by hitting it */}
      <section className="rounded-xl bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium text-neutral-400">Today&apos;s cap (Tier {tier})</span>
          <span className="text-neutral-500">
            {fmtPeso(spentTodayPeso)} / {fmtPeso(capPeso)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-900">
          <div className="h-full bg-accent" style={{ width: `${capPct}%` }} />
        </div>
        <p className="mt-1.5 text-[10.5px] text-neutral-500">
          Caps reset at midnight · Tier 2 raises it to ₱5,000/day
        </p>
      </section>

      {/* Payout rail */}
      <section className="rounded-xl bg-surface p-4 shadow-sm">
        <div className="text-[13.5px] font-medium">Payout method</div>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {(Object.keys(METHOD_LABELS) as PayoutMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMethod(m);
                setPeso(m === "load" ? 10 : 100);
              }}
              className={cn(
                "rounded-lg border px-2 py-2.5 text-[12.5px] font-medium transition-colors",
                method === m
                  ? "border-accent bg-accent-900 text-accent-300"
                  : "border-divider text-neutral-500",
              )}
            >
              {METHOD_LABELS[m]}
              <span className="block text-[10px] text-neutral-500">
                min {m === "load" ? "₱10" : "₱100"}
              </span>
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="mt-4 text-[13.5px] font-medium">Amount</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {REDEEM_PRESETS.map((p) => {
            const affordable = p <= spendablePeso;
            const underCap = spentTodayPeso + p <= capPeso;
            const ok = affordable && underCap;
            return (
              <button
                key={p}
                type="button"
                disabled={!ok}
                onClick={() => {
                  setPeso(p);
                  setCustom("");
                }}
                className={cn(
                  "rounded-lg border py-2.5 text-[13px] font-medium disabled:opacity-40",
                  peso === p && !custom
                    ? "border-accent bg-accent-900 text-accent-300"
                    : "border-divider text-neutral-500",
                )}
                title={!ok ? (affordable ? "Over today's cap" : "Not enough balance") : undefined}
              >
                ₱{p}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={method === "load" ? 10 : 100}
            step={10}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const v = Number(e.target.value);
              if (v > 0) setPeso(v);
            }}
            placeholder={`Custom (₱, min ${method === "load" ? 10 : 100})`}
            className="min-h-[44px] flex-1 rounded-lg border border-divider bg-surface px-3.5 text-[14px] outline-none placeholder:text-neutral-600 focus:border-accent"
          />
          <span className="text-[12px] text-neutral-500">= {fmtPts(points)}</span>
        </div>

        {/* Account */}
        <div className="mt-4 text-[13.5px] font-medium">
          {method === "load" ? "Mobile number to load" : `${METHOD_LABELS[method]} number`}
        </div>
        <input
          type="tel"
          inputMode="numeric"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="09XX XXX XXXX"
          className="mt-2 min-h-[48px] w-full rounded-lg border border-divider bg-surface px-4 text-[16px] outline-none placeholder:text-neutral-600 focus:border-accent"
        />
        {method === "load" && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(Object.keys(NETWORK_LABELS) as LoadNetwork[]).map((nw) => (
              <button
                key={nw}
                type="button"
                onClick={() => setNetwork(nw)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium",
                  network === nw ? "bg-accent-800 text-accent-100" : "bg-neutral-900 text-neutral-400",
                )}
              >
                {NETWORK_LABELS[nw]}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* E3: full math, spelled out */}
      <section className="rounded-xl bg-surface p-4 text-[13px] shadow-sm">
        <div className="flex justify-between py-1"><span className="text-neutral-500">Points</span><span>{fmtPts(points)}</span></div>
        <div className="flex justify-between py-1"><span className="text-neutral-500">Fees</span><span className="text-ok">₱0.00</span></div>
        <div className="flex justify-between py-1"><span className="text-neutral-500">You receive</span><span className="font-semibold">{fmtPeso(points / 100)}</span></div>
        <div className="flex justify-between border-t border-divider/60 py-1.5 pt-2">
          <span className="text-neutral-500">Balance after</span>
          <span>{fmtPts(Math.max(0, spendablePts - points))}</span>
        </div>
      </section>

      {error && <p className="rounded-lg bg-bad-bg px-3.5 py-3 text-[12.5px] text-bad">{error}</p>}

      <button
        type="submit"
        disabled={!validation.ok || busy}
        className="grid min-h-[48px] w-full place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow disabled:opacity-45"
      >
        {busy
          ? "Submitting…"
          : `Redeem ${fmtPeso(points / 100)} to ${METHOD_LABELS[method]}${masked ? ` ${masked}` : ""}`}
      </button>
      {!validation.ok && validation.reason && (
        <p className="text-center text-[11.5px] text-neutral-500">{validation.reason}</p>
      )}
    </form>
  );
}
