import type { Metadata } from "next";
import Link from "next/link";
import { Logo, Tag } from "@/components/ui";

export const metadata: Metadata = { title: "Welcome, ka-quest! — PisoQuest" };

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6 py-10">
      <div className="flex justify-center">
        <Logo size={40} />
      </div>

      <div className="mt-12 flex flex-col items-center gap-5 text-center">
        <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-ok-bg text-ok">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
        </span>
        <div>
          <h1 className="mb-1.5 text-[22px] font-semibold">Welcome, ka-quest!</h1>
          <p className="text-[13px] text-neutral-400">
            Your account is ready at <b className="text-neutral-200">Tier 0 · Starter</b>.
            You can earn right away — verify later to unlock cash-outs.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 text-left">
          <div className="flex items-center justify-between rounded-lg bg-surface px-3.5 py-3 shadow-sm">
            <span className="text-[13px]">Earn points</span>
            <Tag tone="ok">Unlocked</Tag>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface px-3.5 py-3 shadow-sm">
            <span className="text-[13px]">Cash out to GCash / Maya / load</span>
            <Tag tone="neutral">Needs Tier 1</Tag>
          </div>
        </div>

        <Link
          href="/quests"
          className="grid min-h-[48px] w-full place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow"
        >
          Browse quests
        </Link>
        <Link href="/profile" className="text-[13px] text-accent-400">
          Complete my profile now (2 min)
        </Link>
      </div>
    </main>
  );
}
