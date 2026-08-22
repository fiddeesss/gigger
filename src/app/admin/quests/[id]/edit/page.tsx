import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuestForm } from "@/components/quest-form";

export const dynamic = "force-dynamic";

export default async function EditQuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: quest } = await admin.from("quests").select("*").eq("id", id).single();
  if (!quest) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/quests" className="text-[13px] text-neutral-500">
        ← Quests
      </Link>
      <h1 className="text-lg font-semibold">Edit quest</h1>
      <QuestForm quest={quest} />
    </div>
  );
}
