"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtPts, fmtPeso } from "@/lib/constants";
import { timeAgo } from "@/lib/dates";
import { StatusBadge, Tag } from "@/components/ui";

interface PayoutRowData {
  id: string;
  reference_no: string;
  points: number;
  peso: number;
  method: string;
  account: { number?: string; network?: string };
  status: "pending" | "on_hold";
  hold_reason: string | null;
  created_at: string;
  user: { full_name: string | null; email: string; tier: number };
}

export function PayoutQueue({ rows }: { rows: PayoutRowData[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "pay" | "hold" | "reject") {
    if (busy) return;
    if (action === "hold" && note.trim().length < 5) {
      setError("A hold needs a reason (5+ chars).");
      return;
    }
    setBusy(id);
    setError(null);
    const res = await fetch("/api/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redemptionId: id, action, note: note.trim() || null }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!body.ok) {
      setError(body.reason ?? "Action failed — try again.");
      return;
    }
    setOpen(null);
    setNote("");
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-surface p-8 text-center text-sm text-neutral-500 shadow-sm">
        No pending payouts. 🎉
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="rounded-lg bg-bad-bg px-3.5 py-2.5 text-xs text-bad">{error}</p>}
      {rows.map((r) => {
        const masked = r.account.number ? `•••• ${r.account.number.slice(-4)}` : "—";
        return (
          <div key={r.id} className="rounded-xl bg-surface p-3.5 shadow-sm">
            <button
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => {
                setOpen(open === r.id ? null : r.id);
                setNote(r.hold_reason ?? "");
              }}
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-[13px] font-medium">
                  {r.user.full_name || r.user.email}
                </span>
                <span className="text-[11px] text-neutral-500">
                  {r.reference_no} · {r.method.toUpperCase()} {masked} · {timeAgo(r.created_at)} · Tier {r.user.tier}
                </span>
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className="text-[13px] font-semibold text-accent-300">{fmtPts(r.points)}</span>
                <span className="text-[12px] text-neutral-500">{fmtPeso(r.peso)}</span>
                <StatusBadge status={r.status} kind="redemption" />
              </div>
            </button>

            {open === r.id && (
              <div className="mt-3 flex flex-col gap-2 border-t border-divider/60 pt-3">
                {r.status === "on_hold" && r.hold_reason && (
                  <p className="rounded-lg bg-warn-bg px-3 py-2 text-[11.5px] text-warn">
                    Hold reason: {r.hold_reason}
                  </p>
                )}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={
                    r.status === "on_hold"
                      ? "Update the hold reason or add a note…"
                      : "Note (required for holds)…"
                  }
                  className="rounded-lg border border-divider bg-bg p-2.5 text-[12.5px] outline-none focus:border-accent"
                />
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => act(r.id, "pay")}
                    disabled={busy !== null}
                    className="grid min-h-[42px] place-items-center rounded-lg bg-ok text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-45"
                    title="Confirm: you have sent this out-of-band"
                  >
                    {busy === r.id ? "…" : "Paid ✓"}
                  </button>
                  <button
                    onClick={() => act(r.id, "hold")}
                    disabled={busy !== null || r.status !== "pending"}
                    className="grid min-h-[42px] place-items-center rounded-lg bg-warn text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-45"
                  >
                    Hold
                  </button>
                  <button
                    onClick={() => act(r.id, "reject")}
                    disabled={busy !== null}
                    className="grid min-h-[42px] place-items-center rounded-lg bg-bad text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-45"
                  >
                    Reject
                  </button>
                </div>
                <p className="text-[10.5px] text-neutral-500">
                  Pay = you have sent the money out-of-band (GCash app, etc). This
                  debits the user&apos;s balance and marks the receipt.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
