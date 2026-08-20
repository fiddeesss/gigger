"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "@/components/ui";

export function StandingPanel({ userId, standing }: { userId: string; standing: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStanding(next: "good_standing" | "restricted" | "suspended") {
    if (busy) return;
    if (next !== "good_standing" && reason.trim().length < 5) {
      setError("A reason is required (5+ chars).");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/standing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, standing: next, reason: reason.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!body.ok) {
      setError(body.reason ?? "Action failed.");
      return;
    }
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-neutral-500">Standing:</span>
        <Tag tone={standing === "good_standing" ? "ok" : standing === "suspended" ? "bad" : "warn"}>
          {standing.replace("_", " ")}
        </Tag>
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (shown to support, required for restrict/suspend)"
        className="min-h-[40px] rounded-lg border border-divider bg-bg px-3 text-[12.5px] outline-none focus:border-accent"
      />
      {error && <p className="text-[11.5px] text-bad">{error}</p>}
      <div className="flex gap-1.5">
        <button
          onClick={() => setStanding("good_standing")}
          disabled={busy || standing === "good_standing"}
          className="flex-1 rounded-lg bg-ok py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          Restore
        </button>
        <button
          onClick={() => setStanding("restricted")}
          disabled={busy || standing === "restricted"}
          className="flex-1 rounded-lg bg-warn py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          Restrict
        </button>
        <button
          onClick={() => setStanding("suspended")}
          disabled={busy || standing === "suspended"}
          className="flex-1 rounded-lg bg-bad py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          Suspend
        </button>
      </div>
    </div>
  );
}
