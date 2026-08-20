"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewPanel({
  submissionId,
  status,
}: {
  submissionId: string;
  status: "under_review" | "flagged";
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [signal, setSignal] = useState("speed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRef = { current: null as HTMLTextAreaElement | null };

  async function act(action: "approve" | "reject" | "flag") {
    if (busy) return;
    if (action === "reject" && note.trim().length < 10) {
      setError("Rejection needs a note in your own words (10+ chars).");
      noteRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId,
        action,
        note: note.trim() || null,
        signal: action === "flag" ? signal : null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!body.ok) {
      setError(body.reason ?? "Review failed — try again.");
      return;
    }
    router.push("/admin/reviews?reviewed=1");
    router.refresh();
  }

  // Keyboard: a = approve, f = flag, r = reject (not while typing)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (busy) return;
      if (e.key === "a") void act("approve");
      if (e.key === "f") void act("flag");
      if (e.key === "r") void act("reject");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, note, signal]);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-medium">Decision</div>
        <span className="text-[10.5px] text-neutral-500">
          <kbd className="rounded bg-neutral-900 px-1">A</kbd> approve ·{" "}
          <kbd className="rounded bg-neutral-900 px-1">F</kbd> flag ·{" "}
          <kbd className="rounded bg-neutral-900 px-1">R</kbd> reject
        </span>
      </div>

      {status === "flagged" && (
        <p className="rounded-lg bg-warn-bg px-3 py-2.5 text-[12px] text-warn">
          This is the second review. Confirm or overturn the flag.
        </p>
      )}

      <textarea
        ref={noteRef as never}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder={
          status === "flagged"
            ? "Note for the record…"
            : "Your note (required for rejections — quoted back to the user)"
        }
        className="min-h-[80px] rounded-lg border border-divider bg-bg p-3 text-[13px] outline-none placeholder:text-neutral-600 focus:border-accent"
      />

      {status === "under_review" && (
        <label className="flex items-center gap-2 text-[12px] text-neutral-500">
          Flag signal
          <select
            value={signal}
            onChange={(e) => setSignal(e.target.value)}
            className="rounded-lg border border-divider bg-surface px-2 py-1.5 text-[12px]"
          >
            <option value="speed">Suspiciously fast</option>
            <option value="duplicate">Looks duplicated</option>
            <option value="quality">Poor quality / unclear</option>
            <option value="other">Other</option>
          </select>
        </label>
      )}

      {error && <p className="text-[12px] text-bad">{error}</p>}

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => act("approve")}
          disabled={busy}
          className="grid min-h-[44px] place-items-center rounded-lg bg-ok text-white text-[13.5px] font-medium hover:opacity-90 disabled:opacity-45"
        >
          Approve
        </button>
        <button
          onClick={() => act("flag")}
          disabled={busy || status === "flagged"}
          className="grid min-h-[44px] place-items-center rounded-lg bg-warn text-white text-[13.5px] font-medium hover:opacity-90 disabled:opacity-45"
        >
          Flag
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
