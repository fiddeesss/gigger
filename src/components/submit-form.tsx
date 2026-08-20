"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Quest } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { validatePayload, VIDEO_MIN_SEC, VIDEO_MAX_SEC } from "@/lib/submissions";
import { UploadDropzone, type UploadedFile } from "@/components/upload-dropzone";
import { RewardLockup, Tag } from "@/components/ui";

interface Draft {
  photos: UploadedFile[];
  video: UploadedFile[];
  videoDurationSec: number | null;
  declarations: { ownRecording: boolean; recordedToday: boolean };
  text: string;
  pollOption: string;
  pollCity: string;
  surveyAnswers: Record<string, string>;
  labels: UploadedFile[];
  labelCounts: Record<string, number>;
  guideChecks: Record<number, boolean>;
}

const EMPTY: Draft = {
  photos: [],
  video: [],
  videoDurationSec: null,
  declarations: { ownRecording: false, recordedToday: false },
  text: "",
  pollOption: "",
  pollCity: "",
  surveyAnswers: {},
  labels: [],
  labelCounts: {},
  guideChecks: {},
};

const LABEL_CATEGORIES = [
  "Jeepney route signs",
  "Store signs",
  "Barangay signs",
  "Street name plates",
];

const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export function SubmitForm({
  quest,
  userId,
  submissionId,
}: {
  quest: Quest;
  userId: string;
  submissionId?: string;
}) {
  const router = useRouter();
  const draftKey = `pq-draft-${quest.slug}-${submissionId ?? "new"}`;
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Restore local draft (C3: connection failures don't lose work)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) setDraft({ ...EMPTY, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, [draftKey]);

  // Persist every change (throttled by React state; localStorage is sync)
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {}
  }, [draft, loaded, draftKey]);

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  const payload = useMemo(() => {
    switch (quest.proof_type) {
      case "photo":
        return { type: "photo" as const, urls: draft.photos.map((f) => f.path) };
      case "video":
        return {
          type: "video" as const,
          url: draft.video[0]?.path ?? "",
          durationSec: draft.videoDurationSec ?? 0,
          declarations: draft.declarations,
        };
      case "text":
        return { type: "text" as const, text: draft.text };
      case "poll":
        return { type: "poll" as const, option: draft.pollOption, city: draft.pollCity || undefined };
      case "survey":
        return { type: "survey" as const, answers: draft.surveyAnswers };
      case "labels":
        return {
          type: "labels" as const,
          fileUrl: draft.labels[0]?.path ?? "",
          counts: draft.labelCounts,
        };
    }
  }, [draft, quest.proof_type]);

  const validation = validatePayload(quest.proof_type, payload as never);
  const labelTotal = Object.values(draft.labelCounts).reduce((a, b) => a + b, 0);
  const guideDone = Object.values(draft.guideChecks).filter(Boolean).length;

  async function onVideoSelected(files: UploadedFile[]) {
    setVideoError(null);
    const file = files[0];
    if (!file) return;
    // Pre-check duration before upload (C6: catch rejections before a human sees it)
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? "anon";
    const path = `${uid}/${crypto.randomUUID()}/${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("proofs").upload(path, file as unknown as File, { cacheControl: "3600" });
    if (upErr) {
      setVideoError("Upload failed — check your connection and retry.");
      return;
    }
    // measure duration
    const url = URL.createObjectURL(file as unknown as File);
    const probe = new Promise<number>((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => resolve(v.duration);
      v.onerror = () => resolve(0);
      v.src = url;
    });
    const duration = await probe;
    URL.revokeObjectURL(url);
    if (duration < VIDEO_MIN_SEC || duration > VIDEO_MAX_SEC) {
      setVideoError(`Video must be ${VIDEO_MIN_SEC}s–${VIDEO_MAX_SEC}s. Yours is ${Math.round(duration)}s.`);
      return;
    }
    update({ video: [{ path, name: file.name, size: file.size, kind: "video" }], videoDurationSec: Math.round(duration) });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busyRef.current || submitting) return;
    if (!validation.ok) {
      setSubmitError(validation.reason ?? "Check your submission.");
      return;
    }
    busyRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();
    const { data, error } = submissionId
      ? await supabase.rpc("resubmit_submission", {
          p_submission_id: submissionId,
          p_user_id: userId,
          p_payload: payload,
        })
      : await supabase.rpc("submit_quest", {
          p_quest_id: quest.id,
          p_user_id: userId,
          p_payload: payload,
        });
    if (error) {
      setSubmitError("Couldn't submit — check your connection and try again.");
      setSubmitting(false);
      busyRef.current = false;
      return;
    }
    const res = data as { ok: boolean; reason?: string; submission_id?: string };
    if (!res.ok) {
      setSubmitError(
        res.reason === "full"
          ? "This quest just filled up — try another one."
          : res.reason === "tier"
            ? "This quest needs a higher tier."
            : res.reason === "already-submitted"
              ? "You already submitted this quest."
              : res.reason === "not-rejected"
                ? "This submission can't be resubmitted."
                : "Couldn't submit right now. Try again.",
      );
      setSubmitting(false);
      busyRef.current = false;
      return;
    }
    localStorage.removeItem(draftKey);
    if (submissionId) {
      router.push(`/work/${submissionId}?resubmitted=1`);
    } else {
      router.push(`/quests/${quest.slug}/submitted?sid=${res.submission_id}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 px-4 py-4">
      {/* Guide (C5/C6): tickable checklist, always reachable above the form */}
      <section className="rounded-xl bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-[13.5px] font-medium">How to complete it</div>
          <Tag tone={guideDone === quest.instructions.length ? "ok" : "neutral"}>
            {guideDone}/{quest.instructions.length} done
          </Tag>
        </div>
        <ol className="mt-2.5 flex flex-col gap-2">
          {quest.instructions.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => update({ guideChecks: { ...draft.guideChecks, [i]: !draft.guideChecks[i] } })}
                className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md border text-[11px] ${
                  draft.guideChecks[i]
                    ? "border-accent bg-accent-800 text-accent-100"
                    : "border-neutral-700 text-transparent"
                }`}
                aria-label={`Toggle step ${i + 1}`}
              >
                ✓
              </button>
              <span className={`text-[13px] leading-relaxed text-neutral-400 ${draft.guideChecks[i] ? "line-through opacity-60" : ""}`}>
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Reward + review promise */}
      <section className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-sm">
        <RewardLockup pts={quest.reward_points} />
        <span className="text-[11px] text-neutral-500">Review ≤ 24h</span>
      </section>

      {/* Proof inputs per type */}
      <section className="rounded-xl bg-surface p-4 shadow-sm">
        <div className="text-[13.5px] font-medium">Your proof</div>

        {quest.proof_type === "photo" && (
          <div className="mt-3">
            <UploadDropzone
              accept={PHOTO_ACCEPT}
              maxSizeMB={8}
              kind="photo"
              label="Upload your photos"
              hint="Clear, unedited photos get approved faster."
              files={draft.photos}
              onChange={(photos) => update({ photos })}
            />
            <p className="mt-2 text-[11px] text-neutral-500">
              Blurry or cropped proof is the #1 rejection reason.
            </p>
          </div>
        )}

        {quest.proof_type === "video" && (
          <div className="mt-3 flex flex-col gap-3">
            <UploadDropzone
              accept={VIDEO_ACCEPT}
              maxSizeMB={50}
              multiple={false}
              kind="video"
              label="Record / upload your video"
              hint={`${VIDEO_MIN_SEC}s–${VIDEO_MAX_SEC}s, mp4 or webm`}
              files={draft.video}
              onChange={(video) => {
                setDraft((d) => ({ ...d, video }));
                void onVideoSelected(video);
              }}
            />
            {videoError && <p className="text-[12px] text-bad">{videoError}</p>}
            <label className="flex items-start gap-2.5 text-[12.5px] text-neutral-400">
              <input
                type="checkbox"
                checked={draft.declarations.ownRecording}
                onChange={(e) => update({ declarations: { ...draft.declarations, ownRecording: e.target.checked } })}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              />
              This is my own recording — I made it for this quest.
            </label>
            <label className="flex items-start gap-2.5 text-[12.5px] text-neutral-400">
              <input
                type="checkbox"
                checked={draft.declarations.recordedToday}
                onChange={(e) => update({ declarations: { ...draft.declarations, recordedToday: e.target.checked } })}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              />
              I recorded this today.
            </label>
          </div>
        )}

        {quest.proof_type === "text" && (
          <div className="mt-3 flex flex-col gap-1.5">
            <textarea
              value={draft.text}
              onChange={(e) => update({ text: e.target.value })}
              rows={6}
              placeholder="Write your review here…"
              className="min-h-[140px] rounded-lg border border-divider bg-surface p-3 text-[14px] leading-relaxed outline-none placeholder:text-neutral-600 focus:border-accent"
            />
            <span className="text-right text-[11px] text-neutral-500">{draft.text.length} chars</span>
          </div>
        )}

        {quest.proof_type === "poll" && (
          <div className="mt-3 flex flex-col gap-2">
            {(quest.options as string[]).map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-3 text-[13.5px] ${
                  draft.pollOption === opt ? "border-accent bg-accent-900" : "border-divider bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name="poll"
                  checked={draft.pollOption === opt}
                  onChange={() => update({ pollOption: opt })}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                {opt}
              </label>
            ))}
            <input
              value={draft.pollCity}
              onChange={(e) => update({ pollCity: e.target.value })}
              placeholder="Your city (optional)"
              className="mt-1 min-h-[48px] rounded-lg border border-divider bg-surface px-4 text-[14px] outline-none placeholder:text-neutral-600 focus:border-accent"
            />
          </div>
        )}

        {quest.proof_type === "survey" && (
          <div className="mt-3 flex flex-col gap-4">
            {(quest.questions as { q: string; type: string; options?: string[] }[]).map((q, qi) => (
              <fieldset key={qi} className="flex flex-col gap-2">
                <legend className="text-[13px] font-medium text-neutral-200">
                  {qi + 1}. {q.q}
                </legend>
                {q.type === "text" ? (
                  <textarea
                    value={draft.surveyAnswers[qi] ?? ""}
                    onChange={(e) => update({ surveyAnswers: { ...draft.surveyAnswers, [qi]: e.target.value } })}
                    rows={2}
                    className="rounded-lg border border-divider bg-surface p-3 text-[13.5px] outline-none placeholder:text-neutral-600 focus:border-accent"
                    placeholder="Your answer (optional)"
                  />
                ) : (
                  (q.options ?? []).map((opt) => (
                    <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${draft.surveyAnswers[qi] === opt ? "border-accent bg-accent-900" : "border-divider"}`}>
                      <input
                        type="radio"
                        name={`survey-${qi}`}
                        checked={draft.surveyAnswers[qi] === opt}
                        onChange={() => update({ surveyAnswers: { ...draft.surveyAnswers, [qi]: opt } })}
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                      {opt}
                    </label>
                  ))
                )}
              </fieldset>
            ))}
          </div>
        )}

        {quest.proof_type === "labels" && (
          <div className="mt-3 flex flex-col gap-3">
            <UploadDropzone
              accept=".csv,.xlsx,.txt,.json,image/*"
              maxSizeMB={20}
              multiple={false}
              kind="file"
              label="Upload your labeled output"
              hint="CSV, spreadsheet, or a screenshot of your work"
              files={draft.labels}
              onChange={(labels) => update({ labels })}
            />
            <div className="text-[12px] font-medium text-neutral-300">Counts (must total 100)</div>
            <div className="flex flex-col gap-2">
              {LABEL_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] text-neutral-400">{cat}</span>
                  <input
                    type="number"
                    min={0}
                    value={draft.labelCounts[cat] ?? ""}
                    onChange={(e) =>
                      update({ labelCounts: { ...draft.labelCounts, [cat]: Math.max(0, Number(e.target.value) || 0) } })
                    }
                    className="w-20 rounded-lg border border-divider bg-surface px-3 py-2 text-right text-[14px] outline-none focus:border-accent"
                  />
                </div>
              ))}
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-neutral-500">Total</span>
                <span className={labelTotal === 100 ? "font-semibold text-ok" : "font-semibold text-warn"}>
                  {labelTotal}/100
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {submitError && (
        <p className="rounded-lg bg-bad-bg px-3.5 py-3 text-[12.5px] text-bad">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={!validation.ok || submitting}
        className="grid min-h-[48px] w-full place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow disabled:opacity-45"
      >
        {submitting ? "Submitting…" : validation.ok ? "Submit your proof" : validation.reason}
      </button>

      <p className="text-center text-[11px] text-neutral-500">
        Draft saves automatically on this device until you submit.
      </p>
    </form>
  );
}
