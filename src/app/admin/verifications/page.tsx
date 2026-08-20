import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tag } from "@/components/ui";
import { timeAgo } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminVerificationsPage() {
  const admin = createAdminClient();
  const { data: requests } = await admin
    .from("verification_requests")
    .select("id, user_id, id_type, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
  const { data: users } = await admin
    .from("profiles")
    .select("id, full_name, email, tier")
    .in("id", userIds);
  const userById = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">ID verifications</h1>
        <span className="text-xs text-neutral-500">{requests?.length ?? 0} pending</span>
      </div>

      {!requests?.length ? (
        <div className="rounded-xl bg-surface p-8 text-center text-sm text-neutral-500 shadow-sm">
          No pending verifications. 🎉
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => {
            const u = userById[r.user_id];
            return (
              <li key={r.id}>
                <Link
                  href={`/admin/verifications/${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[13.5px] font-medium">
                      {u?.full_name || u?.email}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {r.id_type} · {timeAgo(r.created_at)}
                    </span>
                  </div>
                  <Tag tone="review">Review</Tag>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
