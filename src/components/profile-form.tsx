"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.rpc("complete_profile", {
      p_user_id: user.id,
      p_full_name: fullName,
      p_mobile: mobile.replace(/\D/g, ""),
    });
    if (error || !(data as { ok?: boolean })?.ok) {
      setError("Check your name (2+ chars) and a valid 09XX mobile number.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
      <div className="text-[13.5px] font-medium">Complete your profile → Tier 1</div>
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name (as on your ID)"
        className="min-h-[48px] rounded-lg border border-divider bg-surface px-4 text-[14px] outline-none placeholder:text-neutral-600 focus:border-accent"
      />
      <input
        type="tel"
        inputMode="numeric"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        placeholder="Mobile number (09XX XXX XXXX)"
        className="min-h-[48px] rounded-lg border border-divider bg-surface px-4 text-[14px] outline-none placeholder:text-neutral-600 focus:border-accent"
      />
      {error && <p className="text-[12px] text-bad">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="grid min-h-[48px] place-items-center rounded-lg bg-section text-[14.5px] font-medium text-white hover:bg-section-glow disabled:opacity-45"
      >
        {busy ? "Saving…" : "Unlock Tier 1 (₱500/day cash-out)"}
      </button>
      <p className="text-[10.5px] text-neutral-500">
        Tier 1 = name + mobile. Cash-out unlocks immediately — no ID needed yet.
      </p>
    </form>
  );
}
