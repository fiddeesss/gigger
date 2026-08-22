import Link from "next/link";

export const metadata = { title: "Payout terms — PisoQuest" };

export default function PayoutTermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col gap-4 px-6 py-10">
      <Link href="/" className="text-[13px] text-accent-400">← Back</Link>
      <h1 className="text-[22px] font-semibold">Payout terms</h1>
      <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-neutral-400">
        <p><b className="text-neutral-200">The rate is the brand.</b> 100 pts = ₱1.00, always. This rate never changes and applies to every quest, every bonus, and every redemption.</p>
        <p><b className="text-neutral-200">Review before payout.</b> Points only enter your balance after a person approves your submission — usually within 24 hours. Flagged submissions go through a second review (up to 72h).</p>
        <p><b className="text-neutral-200">Redemption minimums.</b> GCash and Maya: ₱100. Prepaid load: ₱10. Requests must be multiples of 10 pts.</p>
        <p><b className="text-neutral-200">Daily caps.</b> Tier 1: ₱500/day. Tier 2: ₱5,000/day. Caps reset at midnight (Philippine time) and include pending, held, and paid requests.</p>
        <p><b className="text-neutral-200">Tiers.</b> Tier 0 (just signed up) can earn but not cash out. Tier 1 (name + mobile) unlocks cash-outs. Tier 2 (government ID + selfie, reviewed) unlocks the higher cap and priority payout.</p>
        <p><b className="text-neutral-200">Processing.</b> Approved redemptions are paid out manually — usually within 48 hours. Every payout has a reference number (PQ-XXXXXX) that appears on your receipt and in your history.</p>
        <p><b className="text-neutral-200">Holds &amp; flags.</b> We may hold a payout to protect against fraud or account takeover; the reason is always shown, and it never affects your other earnings. Suspended balances are held, never confiscated.</p>
        <p><b className="text-neutral-200">No fees. Ever.</b> PisoQuest takes nothing from your payouts.</p>
        <p className="rounded-lg bg-neutral-900 p-3 text-[12px] text-neutral-500">
          Questions about a payout? Email <a href="mailto:support@pisoquest.app" className="text-accent-400">support@pisoquest.app</a> with your reference number.
        </p>
      </div>
    </main>
  );
}
