import Link from "next/link";

export const metadata = { title: "Terms of service — PisoQuest" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col gap-4 px-6 py-10">
      <Link href="/" className="text-[13px] text-accent-400">← Back</Link>
      <h1 className="text-[22px] font-semibold">Terms of service</h1>
      <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-neutral-400">
        <p><b className="text-neutral-200">1. What PisoQuest is.</b> A questing and rewards service: you complete small tasks, a person reviews your proof, and approved submissions earn points that can be redeemed for GCash, Maya, or load.</p>
        <p><b className="text-neutral-200">2. Accounts.</b> One account per person. You must be at least 18 (or the minimum age in your area). Keep your email secure — we never ask for your password or your codes.</p>
        <p><b className="text-neutral-200">3. Submissions.</b> Your proof must be honest, your own work, and made for this quest. Blurry, cropped, duplicated, or misleading proof is the top reason for rejection. Rejected work can be resubmitted with fixes.</p>
        <p><b className="text-neutral-200">4. Points &amp; redemption.</b> See the payout terms. One important rule: pending redemption requests reduce what you can redeem, and rejected requests don&apos;t cost you anything.</p>
        <p><b className="text-neutral-200">5. Referrals.</b> You earn a bonus when a friend you invited completes their first quest. Self-invites don&apos;t count; bonuses cap at 10 friends per month. Referral abuse (including creating accounts just to farm bonuses) voids bonuses and may suspend accounts.</p>
        <p><b className="text-neutral-200">6. Account standing.</b> We may restrict or suspend accounts that violate these terms (fraud, abuse, fake submissions, or attempts to game the review process). A suspension holds — never confiscates — your balance, and you can appeal by email. We reply within 48 hours.</p>
        <p><b className="text-neutral-200">7. Fraud.</b> Attempting to defraud the system (fake proofs, duplicate accounts, coordinated abuse) may result in suspension and forfeiture of pending rewards. We keep it human: flagged submissions get a second review before any penalty.</p>
        <p><b className="text-neutral-200">8. No guarantee of quests.</b> Quest supply varies. We may pause, close, or change quests at any time. Approved rewards are always honored.</p>
        <p><b className="text-neutral-200">9. Liability.</b> PisoQuest is provided as-is. Our maximum liability to you is the balance in your account. We are not liable for payout delays caused by third parties (banks, e-wallets, networks).</p>
        <p><b className="text-neutral-200">10. Changes.</b> We&apos;ll give you notice before terms that affect your balance change.</p>
        <p className="rounded-lg bg-neutral-900 p-3 text-[12px] text-neutral-500">
          Questions: <a href="mailto:support@pisoquest.app" className="text-accent-400">support@pisoquest.app</a>
        </p>
      </div>
    </main>
  );
}
