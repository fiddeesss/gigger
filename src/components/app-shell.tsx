"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BalanceChip } from "@/components/balance-chip";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/quests", label: "Quests", icon: IconQuests },
  { href: "/work", label: "Work", icon: IconWork },
  { href: "/wallet", label: "Wallet", icon: IconWallet },
  { href: "/profile", label: "Profile", icon: IconProfile },
];

export function AppShell({
  balancePts,
  children,
}: {
  balancePts: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="sticky top-0 z-20 border-b border-divider/70 bg-bg/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[15px] font-semibold">
            {activeTab ? activeTab.label : "PisoQuest"}
          </span>
          <BalanceChip pts={balancePts} />
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-divider/70 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[480px]">
          {TABS.map((t) => {
            const active = activeTab?.href === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium",
                  active ? "text-accent-400" : "text-neutral-500",
                )}
              >
                <t.icon className={active ? "text-accent-400" : "text-neutral-600"} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function IconQuests({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function IconWork({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconWallet({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </svg>
  );
}
function IconProfile({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </svg>
  );
}
