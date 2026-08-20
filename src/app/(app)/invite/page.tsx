// Placeholder — Phase 7 (invites) replaces this.
import Link from "next/link";

export default function InvitePage() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="text-[18px] font-semibold">Invite a kaibigan</h1>
      <div className="rounded-xl bg-surface p-4 text-[13px] text-neutral-500 shadow-sm">
        Your referral link and bonus tracker arrive with the invites build —
        earn ₱10 per friend who finishes their first quest.
      </div>
      <Link href="/profile" className="text-center text-[13px] text-accent-400">
        ← Back to profile
      </Link>
    </div>
  );
}
