import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Phase 3 replaces this stub with the real submission flow (uploads, pre-checks,
// draft persistence, review confirmation timeline).
export default async function SubmitStubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: quest } = await supabase
    .from("quests")
    .select("id, title, reward_points, proof_type")
    .eq("slug", slug)
    .single();

  if (!quest) redirect("/quests");

  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("quest_id", quest.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) redirect(`/quests/${slug}`);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <Link href={`/quests/${slug}`} className="text-[13px] text-neutral-500">
        ← Back to quest
      </Link>
      <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-sm">
        <h1 className="text-[18px] font-semibold">{quest.title}</h1>
        <p className="text-[13px] text-neutral-500">
          The submission flow is the next build step (proof uploads, pre-checks,
          review timeline). Check back shortly — or follow the repo.
        </p>
      </div>
    </div>
  );
}
