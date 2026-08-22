import Link from "next/link";

export const metadata = { title: "Privacy — PisoQuest" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col gap-4 px-6 py-10">
      <Link href="/" className="text-[13px] text-accent-400">← Back</Link>
      <h1 className="text-[22px] font-semibold">Privacy</h1>
      <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-neutral-400">
        <p><b className="text-neutral-200">What we collect.</b> Your email (for login), your name and mobile number (required for Tier 1 and for payouts), and your quest submissions — photos, videos, text, and answers. If you verify your identity, we collect a photo of your government ID and a selfie.</p>
        <p><b className="text-neutral-200">Why we collect it.</b> To run the review process that keeps payouts honest, to pay you correctly, and to prevent fraud. Your submission content is reviewed by a real person.</p>
        <p><b className="text-neutral-200">Identity documents.</b> Your ID photo and selfie are encrypted, visible only to our verification team, and deleted after review. We never share them.</p>
        <p><b className="text-neutral-200">What we don&apos;t do.</b> We never sell your data. We never call you or ask for your code or password. We don&apos;t show ads based on your submissions.</p>
        <p><b className="text-neutral-200">Storage.</b> Your data is stored in secured cloud infrastructure (Supabase, region Singapore/ap-northeast-1). Uploads live in private storage buckets.</p>
        <p><b className="text-neutral-200">Deletion.</b> You can ask us to delete your account and data anytime by emailing <a href="mailto:support@pisoquest.app" className="text-accent-400">support@pisoquest.app</a>. We keep only what the law requires (e.g., payout records).</p>
        <p><b className="text-neutral-200">Changes.</b> If this policy changes in a way that matters, we&apos;ll tell you before it takes effect.</p>
        <p className="rounded-lg bg-neutral-900 p-3 text-[12px] text-neutral-500">
          Effective: at launch. Questions: <a href="mailto:support@pisoquest.app" className="text-accent-400">support@pisoquest.app</a>
        </p>
      </div>
    </main>
  );
}
