import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitForm } from "@/components/submit-form";
import { canAttempt } from "@/lib/quests";
import { effectiveTier } from "@/lib/state";

export const dynamic = "force-dynamic";

export default async function SubmitPage({
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
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .single();

  if (!quest) redirect("/quests");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const attempt = canAttempt(quest, profile ?? { tier: 0 });
  if (!attempt.ok) redirect(`/quests/${slug}`);

  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("quest_id", quest.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect(`/quests/${slug}`);

  return (
    <div className="flex flex-col pb-6">
      <div className="px-4 pt-4">
        <Link href={`/quests/${slug}`} className="text-[13px] text-neutral-500">
          ← Back to quest
        </Link>
        <h1 className="mt-2 text-[18px] font-semibold leading-snug">{quest.title}</h1>
      </div>
      <SubmitForm quest={quest} userId={user.id} />
    </div>
  );
}
