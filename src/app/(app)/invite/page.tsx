import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvitePanel } from "@/components/invite-panel";
import { fmtPeso, INVITE_BONUS, INVITE_MONTHLY_CAP } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code, referred_by")
    .eq("id", user.id)
    .single();
  if (!profile) notFound();

  const admin = createAdminClient();
  const [invitesRes, bonusRes, invitedByRes] = await Promise.all([
    admin
      .from("invites")
      .select("id, invitee_id, status, created_at")
      .eq("inviter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("wallet_ledger")
      .select("delta_points, note, created_at")
      .eq("user_id", user.id)
      .eq("kind", "invite_bonus")
      .order("created_at", { ascending: false }),
    profile.referred_by
      ? admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", profile.referred_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const inviteeIds = [...new Set((invitesRes.data ?? []).map((i) => i.invitee_id).filter(Boolean))];
  const { data: invitees } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", inviteeIds);
  const inviteeById = Object.fromEntries((invitees ?? []).map((p) => [p.id, p]));

  const totalEarned = (bonusRes.data ?? []).reduce((s, r) => s + (r.delta_points ?? 0), 0);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="text-[18px] font-semibold">Invite a kaibigan</h1>

      {/* I2: reward card with the math */}
      <section className="rounded-2xl bg-section p-5 text-white shadow-lg">
        <div className="text-[13px] text-white/85">
          Earn <b className="text-[17px]">{fmtPeso(INVITE_BONUS / 100)}</b> for every friend
          who finishes their first quest — and they get it too.
        </div>
        <div className="mt-2 text-[11px] text-white/60">
          Reward triggers on their <b>first approved</b> quest — not just signup.
          Up to {INVITE_MONTHLY_CAP} friends per month. No self-invites.
        </div>
        <div className="mt-3 rounded-lg bg-white/10 px-3.5 py-2.5 text-[12.5px]">
          Total earned from invites: <b>{fmtPeso(totalEarned / 100)}</b>
        </div>
      </section>

      {profile.referred_by && invitedByRes.data && (
        <p className="rounded-xl bg-neutral-900 px-4 py-3 text-[12px] text-neutral-400">
          You were invited by {invitedByRes.data.full_name || invitedByRes.data.email} —
          they&apos;ll get their bonus once your first quest is approved. 🎉
        </p>
      )}

      <InvitePanel referralCode={profile.referral_code} />

      {/* Joined friends */}
      <section className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-sm">
        <div className="text-[13.5px] font-medium">Friends you&apos;ve invited</div>
        {!invitesRes.data?.length ? (
          <p className="text-[12px] text-neutral-500">
            No invites yet — share your link above.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {invitesRes.data.map((i) => {
              const p = i.invitee_id ? inviteeById[i.invitee_id] : null;
              return (
                <li key={i.id} className="flex items-center justify-between text-[12.5px]">
                  <span className="truncate text-neutral-400">
                    {p ? p.full_name || p.email : "Link sent"}
                  </span>
                  <span
                    className={
                      i.status === "bonus_awarded"
                        ? "font-medium text-ok"
                        : i.status === "joined"
                          ? "text-review"
                          : "text-neutral-500"
                    }
                  >
                    {i.status === "bonus_awarded"
                      ? `+${fmtPeso(INVITE_BONUS / 100)} earned`
                      : i.status === "joined"
                        ? "joined — first quest pending"
                        : "pending"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Bonus history */}
      {bonusRes.data && bonusRes.data.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-sm">
          <div className="text-[13.5px] font-medium">Bonus history</div>
          <ul className="flex flex-col gap-1.5">
            {bonusRes.data.map((b, i) => (
              <li key={i} className="flex items-center justify-between text-[12.5px]">
                <span className="truncate text-neutral-500">{b.note}</span>
                <span className="font-semibold text-accent-300">
                  +{b.delta_points} pts ({fmtPeso((b.delta_points ?? 0) / 100)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
