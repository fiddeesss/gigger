import Link from "next/link";
import { QuestForm } from "@/components/quest-form";

export const dynamic = "force-dynamic";

export default function NewQuestPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/quests" className="text-[13px] text-neutral-500">
        ← Quests
      </Link>
      <h1 className="text-lg font-semibold">New quest</h1>
      <QuestForm />
    </div>
  );
}
