"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VerificationPanel({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    if (busy) return;
    if (action === "reject" && note.trim().length < 10) {
      setError("Rejection needs a note (10+ chars).");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action, note: note.trim() || null }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!body.ok) {
      setError(body.reason ?? "Action failed.");
      return;
    }
    router.push("/admin/verifications?done=1");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Note (required for rejections)…"
        className="min-h-[64px] rounded-lg border border-divider bg-bg p-3 text-[13px] outline-none placeholder:text-neutral-600 focus:border-accent"
      />
      {error && <p className="text-[12px] text-bad">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => act("approve")}
          disabled={busy}
          className="grid min-h-[44px] place-items-center rounded-lg bg-ok text-white text-[13.5px] font-medium hover:opacity-90 disabled:opacity-45"
        >
          Approve → Tier 2
        </button>
        <button
          onClick={() => act("reject")}
          disabled={busy}
          className="grid min-h-[44px] place-items-center rounded-lg bg-bad text-white text-[13.5px] font-medium hover:opacity-90 disabled:opacity-45"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
