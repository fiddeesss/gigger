import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewTimeline } from "@/components/review-timeline";
import { REVIEW_SLA_HOURS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function SubmittedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sid?: string }>;
}) {
  const [{ slug }, { sid }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quest } = await supabase.from("quests").select("title").eq("slug", slug).single();
  if (!quest) redirect("/quests");

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, status, created_at")
    .eq("id", sid ?? "")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!submission) redirect("/work");

  const deadlineMs = Date.parse(submission.created_at) + REVIEW_SLA_HOURS * 3600 * 1000;

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-review-bg text-review">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <div>
          <h1 className="text-[20px] font-semibold">Submitted — under review</h1>
          <p className="mt-1 text-[13px] text-neutral-500">{quest.title}</p>
        </div>
      </div>

      <section className="rounded-xl bg-surface p-4 shadow-sm">
        <ReviewTimeline
          submittedAt={submission.created_at}
          status={submission.status}
          deadlineMs={deadlineMs}
        />
      </section>

      <p className="rounded-xl bg-review-bg px-4 py-3 text-[12.5px] leading-relaxed text-review">
        A real person checks your work. Points land in your wallet only when
        approved — nothing about the review is mysterious.
      </p>

      <div className="flex flex-col gap-2">
        <Link
          href="/work"
          className="grid min-h-[48px] place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow"
        >
          Track it under My work
        </Link>
        <Link
          href="/quests"
          className="grid min-h-[48px] place-items-center rounded-lg bg-surface text-[14px] font-medium text-accent-300 shadow-sm transition-colors hover:bg-neutral-900"
        >
          Browse more quests
        </Link>
      </div>
    </div>
  );
}
