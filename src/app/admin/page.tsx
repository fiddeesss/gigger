import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDeadline } from "@/lib/dates";
import { REVIEW_SLA_HOURS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const admin = createAdminClient();
  const [reviews, flagged, redemptions, verifications, quests, users] = await Promise.all([
    admin.from("submissions").select("created_at").eq("status", "under_review"),
    admin.from("submissions").select("id").eq("status", "flagged"),
    admin.from("redemptions").select("id").in("status", ["pending", "on_hold"]),
    admin.from("verification_requests").select("id").eq("status", "pending"),
    admin.from("quests").select("id").eq("status", "live"),
    admin.from("profiles").select("id").eq("is_admin", false),
  ]);

  const reviewAges = (reviews.data ?? []).map((r) => r.created_at);
  const oldest = reviewAges.length
    ? formatDeadline(Date.parse([...reviewAges].sort()[0]) + REVIEW_SLA_HOURS * 3600 * 1000)
    : null;

  const cards = [
    { label: "Open reviews", value: reviews.data?.length ?? 0, href: "/admin/reviews", tone: oldest ? "Review SLA " + oldest : "" },
    { label: "Flagged", value: flagged.data?.length ?? 0, href: "/admin/reviews?only=flagged" },
    { label: "Pending payouts", value: redemptions.data?.length ?? 0, href: "/admin/redemptions" },
    { label: "ID verifications", value: verifications.data?.length ?? 0, href: "/admin/verifications" },
    { label: "Live quests", value: quests.data?.length ?? 0, href: "/admin/quests" },
    { label: "Users", value: users.data?.length ?? 0, href: "/admin/users" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="flex flex-col gap-1 rounded-xl bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="text-[26px] font-semibold leading-none">{c.value}</span>
            <span className="text-xs text-neutral-500">{c.label}</span>
            {c.tone && <span className="text-[10.5px] text-warn">{c.tone}</span>}
          </Link>
        ))}
      </div>
      {oldest && (
        <p className="rounded-lg bg-review-bg px-3.5 py-2.5 text-xs text-review">
          Oldest submission due {oldest} — the ≤24h promise is the product.
        </p>
      )}
    </div>
  );
}
