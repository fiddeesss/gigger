import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";

const STEPS = [
  {
    n: "1",
    title: "Complete a quest",
    body: "Surveys, app tests, photo tasks — 5 to 30 minutes each.",
  },
  {
    n: "2",
    title: "We review it — usually within 24h",
    body: "A real person checks your proof. Approved = points credited.",
  },
  {
    n: "3",
    title: "Cash out — 100 pts = ₱1, always",
    body: "GCash, Maya, or prepaid load. The rate never changes.",
  },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/quests");

  const loginHref = ref ? `/login?ref=${encodeURIComponent(ref)}` : "/login";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="text-xs text-neutral-500">Libre sumali</span>
      </div>

      <div className="mt-12 flex flex-col gap-2.5">
        <h1 className="text-[26px] font-semibold leading-[1.15]">
          Small quests.
          <br />
          Real pesos.
        </h1>
        <p className="text-[13.5px] text-neutral-400">
          Do quick tasks, get reviewed, cash out to GCash, Maya or load.
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-2.5">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="flex items-start gap-3 rounded-xl bg-surface p-3 shadow-sm"
          >
            <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-accent-900 text-xs font-semibold text-accent-300">
              {s.n}
            </span>
            <div>
              <div className="text-[13.5px] font-medium">{s.title}</div>
              <div className="text-xs text-neutral-500">{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <a
        href={loginHref}
        className="mt-8 grid min-h-[48px] place-items-center rounded-lg bg-section px-5 text-[15px] font-medium text-white transition-colors hover:bg-section-glow"
      >
        Start with my email
      </a>
      <p className="mt-3 text-center text-[11px] text-neutral-600">
        By continuing you agree to the{" "}
        <a href="#" className="text-accent-400">
          payout terms
        </a>{" "}
        · No fees, ever
      </p>
    </main>
  );
}
