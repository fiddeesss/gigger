"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UploadDropzone, type UploadedFile } from "@/components/upload-dropzone";

export function VerifyForm({
  userId,
  idTypes,
  rejectedNote,
}: {
  userId: string;
  idTypes: string[];
  rejectedNote?: string | null;
}) {
  const router = useRouter();
  const [idType, setIdType] = useState<string>(idTypes[0]);
  const [idPhoto, setIdPhoto] = useState<UploadedFile[]>([]);
  const [selfie, setSelfie] = useState<UploadedFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Uploads go to the private `ids` bucket, own folder (storage RLS) via UploadDropzone.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (idPhoto.length === 0 || selfie.length === 0) {
      setError("Upload both your ID photo and a selfie.");
      return;
    }
    if (!consent) {
      setError("Please confirm you agree to the data-handling note.");
      return;
    }
    setBusy(true);
    setError(null);

    // Re-upload isn't needed — UploadDropzone already stored them; but we
    // stored paths in state, so just verify both exist via a light check:
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_verification", {
      p_user_id: userId,
      p_id_type: idType,
      p_id_photo: idPhoto[0].path,
      p_selfie: selfie[0].path,
    });
    if (error || !(data as { ok?: boolean })?.ok) {
      const reason = (data as { reason?: string })?.reason;
      setError(
        reason === "pending-exists"
          ? "You already have a request under review."
          : reason === "already-verified"
            ? "You're already Tier 2."
            : "Couldn't submit — try again.",
      );
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
        <div className="text-[13.5px] font-medium">Government ID</div>
        <div className="flex flex-wrap gap-1.5">
          {idTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setIdType(t)}
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                idType === t ? "bg-accent-800 text-accent-100" : "bg-neutral-900 text-neutral-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="text-[12px] font-medium text-neutral-300">Photo of your ID (front)</div>
        <UploadDropzone
          accept="image/jpeg,image/png,image/webp"
          maxSizeMB={8}
          multiple={false}
          kind="photo"
          label="Upload ID photo"
          hint="Clear, well-lit, all four corners visible"
          files={idPhoto}
          onChange={setIdPhoto}
          bucket="ids"
        />

        <div className="text-[12px] font-medium text-neutral-300">Selfie holding your ID</div>
        <UploadDropzone
          accept="image/jpeg,image/png,image/webp"
          maxSizeMB={8}
          multiple={false}
          kind="photo"
          label="Upload selfie"
          hint="Face + ID clearly readable"
          files={selfie}
          onChange={setSelfie}
          bucket="ids"
        />

        {/* G3: data-handling promise directly under the capture */}
        <label className="flex items-start gap-2.5 text-[11.5px] leading-relaxed text-neutral-500">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          />
          I agree my ID and selfie are used only for verification, stored
          encrypted, and deleted after review.
        </label>
      </section>

      {error && <p className="rounded-lg bg-bad-bg px-3.5 py-3 text-[12.5px] text-bad">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="grid min-h-[48px] place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow disabled:opacity-45"
      >
        {busy ? "Submitting…" : "Submit for verification"}
      </button>
      <p className="text-center text-[10.5px] text-neutral-500">
        Approval unlocks Tier 2: ₱5,000/day cash-out + priority payout.
      </p>
    </form>
  );
}
