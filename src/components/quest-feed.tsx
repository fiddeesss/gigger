"use client";

import { useEffect, useState } from "react";
import type { Quest, Submission } from "@/lib/types";
import { QuestCard } from "@/components/quest-card";
import { DailyEarnBar } from "@/components/daily-earn-bar";
import { SortSheet, type QuestSort, type CategoryFilter } from "@/components/sort-sheet";
import { cn } from "@/lib/cn";

const SORT_OPTIONS: { key: QuestSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "highest", label: "Highest pts" },
  { key: "quickest", label: "Quickest" },
];

export function QuestFeed({
  quests,
  mySubmissions,
  minTier,
  stats,
}: {
  quests: Quest[];
  mySubmissions: Record<string, Submission>;
  minTier: number;
  stats: { approvedPts: number; inReviewCount: number; availablePts: number; availableCount: number };
}) {
  const [sort, setSort] = useState<QuestSort>("newest");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  // local copy for client-side sort/filter
  const [list, setList] = useState(quests);
  useEffect(() => setList(quests), [quests]);

  const filtered = list
    .filter((q) => category === "all" || q.category === category)
    .sort((a, b) => {
      if (sort === "highest") return b.reward_points - a.reward_points;
      if (sort === "quickest") return b.reward_points / b.effort_minutes - a.reward_points / a.effort_minutes;
      return Date.parse(b.starts_at ?? b.created_at) - Date.parse(a.starts_at ?? a.created_at);
    });

  const pendingCount = Object.values(mySubmissions).filter(
    (s) => s.status === "under_review" || s.status === "flagged",
  ).length;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <DailyEarnBar
        approvedPts={stats.approvedPts}
        inReviewCount={stats.inReviewCount}
        availablePts={stats.availablePts}
        availableCount={stats.availableCount}
      />

      <p className="text-[11px] text-neutral-600">
        All submissions reviewed by a person within 24 hours
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setSort(o.key)}
            className={cn(
              "flex-none rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              sort === o.key
                ? "bg-surface text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent)]"
                : "bg-surface text-neutral-400",
            )}
          >
            {o.label}
          </button>
        ))}
        <button
          onClick={() => setSheetOpen(true)}
          className="flex flex-none items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-medium text-neutral-400"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filter
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-surface p-8 text-center">
          <div className="text-[15px] font-medium">No quests here right now</div>
          <p className="text-xs text-neutral-500">
            {pendingCount > 0
              ? `You have ${pendingCount} submission${pendingCount === 1 ? "" : "s"} under review — track them under Work.`
              : "Check back later — new quests drop often."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((q) => (
            <QuestCard
              key={q.id}
              quest={q}
              mySubmission={mySubmissions[q.id]}
              minTierOk={minTier >= q.min_tier}
            />
          ))}
        </div>
      )}

      <SortSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        sort={sort}
        setSort={setSort}
        category={category}
        setCategory={setCategory}
        resultCount={filtered.length}
      />
    </div>
  );
}
