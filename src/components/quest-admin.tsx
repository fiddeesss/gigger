"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_TONES: Record<string, string> = {
  draft: "bg-neutral-800 text-neutral-300",
  live: "bg-ok-bg text-ok",
  paused: "bg-warn-bg text-warn",
  closed: "bg-bad-bg text-bad",
};

export function QuestStatusChip({ status }: { status: string }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_TONES[status] ?? ""}`}>
      {status}
    </span>
  );
}

export function QuestRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/quests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!body.ok) {
      setError(body.reason ?? "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-1">
      {status !== "live" && (
        <button onClick={() => setStatus("live")} className="rounded-lg bg-ok-bg px-2 py-1.5 text-[11px] font-medium text-ok hover:opacity-80">
          Publish
        </button>
      )}
      {status === "live" && (
        <button onClick={() => setStatus("paused")} className="rounded-lg bg-warn-bg px-2 py-1.5 text-[11px] font-medium text-warn hover:opacity-80">
          Pause
        </button>
      )}
      <a href={`/admin/quests/${id}/edit`} className="rounded-lg bg-neutral-900 px-2 py-1.5 text-[11px] font-medium text-neutral-300 hover:bg-neutral-800">
        Edit
      </a>
      {status !== "closed" && (
        <button onClick={() => setStatus("closed")} className="rounded-lg bg-bad-bg px-2 py-1.5 text-[11px] font-medium text-bad hover:opacity-80">
          Close
        </button>
      )}
      {error && <span className="text-[10px] text-bad">{error}</span>}
    </span>
  );
}
