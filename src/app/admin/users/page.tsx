import { createAdminClient } from "@/lib/supabase/admin";
import { StandingPanel } from "@/components/standing-panel";
import { timeAgo } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const admin = createAdminClient();

  let query = admin.from("profiles").select("id, email, full_name, tier, standing, is_admin, created_at");
  if (q) {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }
  const { data: users } = await query.order("created_at", { ascending: false }).limit(50);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Users</h1>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or email"
            className="min-h-[40px] w-48 rounded-lg border border-divider bg-surface px-3 text-[13px] outline-none focus:border-accent"
          />
          <button className="rounded-lg bg-section px-3.5 text-[13px] font-medium text-white">Go</button>
        </form>
      </div>

      <ul className="flex flex-col gap-2">
        {!users?.length ? (
          <li className="rounded-xl bg-surface p-6 text-center text-sm text-neutral-500 shadow-sm">No users found.</li>
        ) : (
          users.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 rounded-xl bg-surface p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium">
                    {u.full_name || u.email}
                    {u.is_admin && <span className="ml-2 text-[10.5px] text-accent-400">ADMIN</span>}
                  </div>
                  <div className="truncate text-[11px] text-neutral-500">
                    {u.email} · Tier {u.tier} · joined {timeAgo(u.created_at)}
                  </div>
                </div>
              </div>
              {!u.is_admin && <StandingPanel userId={u.id} standing={u.standing} />}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
