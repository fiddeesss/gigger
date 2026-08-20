import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtPeso } from "@/lib/constants";

/**
 * Renders a submission payload for reviewers and the user's own work page.
 * Signed URLs are minted server-side with the service role (any path).
 */
export async function ProofView({
  proofType,
  payload,
}: {
  proofType: string;
  payload: Record<string, unknown>;
}) {
  const admin = createAdminClient();

  async function sign(path: string): Promise<string | null> {
    const { data } = await admin.storage.from("proofs").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  if (proofType === "photo") {
    const urls = (payload.urls as string[]) ?? [];
    const signed = await Promise.all(urls.map((u) => sign(u)));
    return (
      <div className="grid grid-cols-2 gap-2">
        {signed.map((url, i) =>
          url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt={`Proof ${i + 1}`} className="w-full rounded-lg border border-divider" />
          ) : (
            <div key={i} className="rounded-lg border border-bad bg-bad-bg p-3 text-[11px] text-bad">
              File unavailable
            </div>
          ),
        )}
      </div>
    );
  }

  if (proofType === "video") {
    const url = await sign(String(payload.url ?? ""));
    const dur = payload.durationSec ? `${Math.round(Number(payload.durationSec))}s` : "";
    return (
      <div className="flex flex-col gap-2">
        {url ? (
          <video src={url} controls className="w-full rounded-lg border border-divider bg-black" />
        ) : (
          <div className="rounded-lg border border-bad bg-bad-bg p-3 text-[11px] text-bad">Video unavailable</div>
        )}
        <div className="text-[11px] text-neutral-500">
          Duration {dur} · Declared own recording:{" "}
          {String((payload.declarations as Record<string, unknown> | undefined)?.ownRecording ?? "—")}
        </div>
      </div>
    );
  }

  if (proofType === "text") {
    return <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-neutral-300">{String(payload.text ?? "")}</p>;
  }

  if (proofType === "poll") {
    return (
      <div className="flex flex-col gap-1 text-[13.5px]">
        <div className="text-neutral-300">Answer: <b className="text-text">{String(payload.option ?? "")}</b></div>
        {Boolean(payload.city) && <div className="text-neutral-500">City: {String(payload.city as string)}</div>}
      </div>
    );
  }

  if (proofType === "survey") {
    const answers = (payload.answers ?? {}) as Record<string, string>;
    return (
      <ul className="flex flex-col gap-1.5 text-[13px]">
        {Object.entries(answers).map(([q, a]) => (
          <li key={q} className="flex gap-2">
            <span className="flex-none text-neutral-500">Q{q}:</span>
            <span className="text-neutral-300">{a}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (proofType === "labels") {
    const url = await sign(String(payload.fileUrl ?? ""));
    const counts = (payload.counts ?? {}) as Record<string, number>;
    return (
      <div className="flex flex-col gap-2">
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="text-[13px] text-accent-400 underline">
            Open labeled output file
          </a>
        )}
        <table className="w-full text-[13px]">
          <tbody>
            {Object.entries(counts).map(([k, v]) => (
              <tr key={k} className="border-b border-divider/60">
                <td className="py-1.5 text-neutral-400">{k}</td>
                <td className="py-1.5 text-right font-medium text-neutral-200">{v}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 font-medium">Total</td>
              <td className="py-1.5 text-right font-semibold">
                {Object.values(counts).reduce((a, b) => a + b, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return <pre className="text-[11px] text-neutral-500">{JSON.stringify(payload, null, 2)}</pre>;
}

export function RewardPts({ pts }: { pts: number }) {
  return (
    <span className="font-semibold text-accent-300">
      +{pts.toLocaleString("en-PH")} pts ({fmtPeso(pts / 100)})
    </span>
  );
}
