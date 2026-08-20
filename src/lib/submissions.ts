// Payload builders + validation for each proof type. Pure functions, tested.
// Payload shapes are stored in submissions.payload and rendered by reviewers.

export interface VideoDeclaration {
  ownRecording: boolean;
  recordedToday: boolean;
}

export const VIDEO_MIN_SEC = 20;
export const VIDEO_MAX_SEC = 300;

export type SubmitPayload =
  | { type: "photo"; urls: string[] }
  | { type: "video"; url: string; durationSec: number; declarations: VideoDeclaration }
  | { type: "text"; text: string }
  | { type: "poll"; option: string; city?: string }
  | { type: "survey"; answers: Record<string, string> }
  | { type: "labels"; fileUrl: string; counts: Record<string, number> };

export function validatePayload(
  proofType: string,
  payload: SubmitPayload,
): { ok: boolean; reason?: string } {
  switch (proofType) {
    case "photo": {
      const urls = (payload as { urls?: string[] }).urls ?? [];
      if (urls.length === 0) return { ok: false, reason: "Upload at least one photo." };
      return { ok: true };
    }
    case "video": {
      const v = payload as Extract<SubmitPayload, { type: "video" }>;
      if (!v.url) return { ok: false, reason: "Upload your video first." };
      if (v.durationSec < VIDEO_MIN_SEC)
        return { ok: false, reason: `Video is too short — at least ${VIDEO_MIN_SEC}s.` };
      if (v.durationSec > VIDEO_MAX_SEC)
        return { ok: false, reason: `Video is too long — max ${VIDEO_MAX_SEC}s.` };
      if (!v.declarations?.ownRecording || !v.declarations?.recordedToday)
        return { ok: false, reason: "Confirm both declarations to submit." };
      return { ok: true };
    }
    case "text": {
      const t = (payload as { text?: string }).text?.trim() ?? "";
      if (t.length < 40) return { ok: false, reason: "Write at least a few sentences (40+ characters)." };
      return { ok: true };
    }
    case "poll": {
      const p = payload as Extract<SubmitPayload, { type: "poll" }>;
      if (!p.option) return { ok: false, reason: "Pick an answer." };
      return { ok: true };
    }
    case "survey": {
      const answers = (payload as { answers?: Record<string, string> }).answers ?? {};
      if (Object.keys(answers).length === 0) return { ok: false, reason: "Answer the questions first." };
      return { ok: true };
    }
    case "labels": {
      const l = payload as Extract<SubmitPayload, { type: "labels" }>;
      if (!l.fileUrl) return { ok: false, reason: "Upload your labeled output file." };
      const total = Object.values(l.counts ?? {}).reduce((a, b) => a + b, 0);
      if (total < 100) return { ok: false, reason: `Counts must add up to 100 (currently ${total}).` };
      return { ok: true };
    }
    default:
      return { ok: false, reason: "Unknown proof type." };
  }
}
