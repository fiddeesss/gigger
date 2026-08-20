import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { VerificationPanel } from "@/components/verification-panel";
import { timeAgo } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function VerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: req } = await admin
    .from("verification_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (!req) notFound();

  const [{ data: user }] = await Promise.all([
    admin.from("profiles").select("full_name, email, tier, mobile").eq("id", req.user_id).single(),
  ]);

  const [idUrl, selfieUrl] = await Promise.all([
    admin.storage.from("ids").createSignedUrl(req.id_photo_url, 3600).then((r) => r.data?.signedUrl ?? null),
    admin.storage.from("ids").createSignedUrl(req.selfie_url, 3600).then((r) => r.data?.signedUrl ?? null),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/verifications" className="text-[13px] text-neutral-500">
        ← Queue
      </Link>

      <div className="rounded-xl bg-surface p-4 shadow-sm">
        <h1 className="text-[16px] font-semibold">{user?.full_name || user?.email}</h1>
        <div className="mt-1 text-xs text-neutral-500">
          {user?.email} · Tier {user?.tier} · submitted {timeAgo(req.created_at)}
        </div>
        <div className="mt-2 text-[13px]">
          ID type: <b>{req.id_type}</b>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-neutral-500">ID photo</span>
          {idUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={idUrl} alt="ID" className="w-full rounded-lg border border-divider" />
          ) : (
            <div className="rounded-lg border border-bad bg-bad-bg p-3 text-[11px] text-bad">Unavailable</div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-neutral-500">Selfie</span>
          {selfieUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selfieUrl} alt="Selfie" className="w-full rounded-lg border border-divider" />
          ) : (
            <div className="rounded-lg border border-bad bg-bad-bg p-3 text-[11px] text-bad">Unavailable</div>
          )}
        </div>
      </div>

      {req.status === "pending" ? (
        <VerificationPanel requestId={req.id} />
      ) : (
        <div className="rounded-xl bg-surface p-4 text-[13px] text-neutral-500 shadow-sm">
          {req.status === "approved" ? "Approved — user is Tier 2." : `Rejected: ${req.admin_note ?? ""}`}
        </div>
      )}
    </div>
  );
}
