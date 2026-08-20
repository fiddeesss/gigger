import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/redemptions", label: "Payouts" },
  { href: "/admin/quests", label: "Quests" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/verifications", label: "IDs" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-divider/70 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="text-[15px] font-semibold">
            PisoQuest <span className="text-accent-400">Admin</span>
          </Link>
          <Link href="/quests" className="text-xs text-neutral-500 hover:text-neutral-400">
            ← Back to app
          </Link>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex-none rounded-lg px-3 py-1.5 text-xs font-medium",
                n.href === "/admin"
                  ? "bg-section text-white"
                  : "bg-surface text-neutral-500 hover:text-neutral-300",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
