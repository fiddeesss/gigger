import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubmitForm } from "@/components/submit-form";

export const dynamic = "force-dynamic";

export default async function ResubmitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, quest_id, status, payload, review_note")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!submission) notFound();
  if (submission.status !== "rejected") redirect(`/work/${id}`);

  const admin = createAdminClient();
  const { data: quest } = await admin
    .from("quests")
    .select("*")
    .eq("id", submission.quest_id)
    .single();
  if (!quest) notFound();

  return (
    <div className="flex flex-col pb-6">
      <div className="px-4 pt-4">
        <Link href={`/work/${id}`} className="text-[13px] text-neutral-500">
          ← Back
        </Link>
        <h1 className="mt-2 text-[18px] font-semibold leading-snug">
          Resubmit: {quest.title}
        </h1>
        {submission.review_note && (
          <p className="mt-1 text-xs text-neutral-500">
            Reviewer&apos;s note: “{submission.review_note}”
          </p>
        )}
      </div>
      <SubmitForm quest={quest} userId={user.id} submissionId={submission.id} />
    </div>
  );
}
