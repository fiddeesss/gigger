"use client";

import { useEffect, useState } from "react";
import type { QuestCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/quests";
import { cn } from "@/lib/cn";

export type QuestSort = "newest" | "highest" | "quickest";
export type CategoryFilter = QuestCategory | "all";

const SORTS: { key: QuestSort; label: string; hint: string }[] = [
  { key: "newest", label: "Newest", hint: "Recently posted" },
  { key: "highest", label: "Highest pts", hint: "Biggest reward first" },
  { key: "quickest", label: "Best pts per minute", hint: "What gig-workers actually want" },
];

export function SortSheet({
  open,
  onClose,
  sort,
  setSort,
  category,
  setCategory,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  sort: QuestSort;
  setSort: (s: QuestSort) => void;
  category: CategoryFilter;
  setCategory: (c: CategoryFilter) => void;
  resultCount: number;
}) {
  const [draftSort, setDraftSort] = useState(sort);
  const [draftCat, setDraftCat] = useState(category);

  useEffect(() => {
    if (open) {
      setDraftSort(sort);
      setDraftCat(category);
    }
  }, [open, sort, category]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[480px] rounded-t-2xl bg-surface p-5 pb-8 shadow-lg">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-800" />

        <div className="text-sm font-semibold">Sort by</div>
        <div className="mt-2 flex flex-col">
          {SORTS.map((o) => (
            <button
              key={o.key}
              onClick={() => setDraftSort(o.key)}
              className="flex items-center justify-between rounded-lg px-2 py-3 text-left hover:bg-neutral-900"
            >
              <span>
                <span className="block text-[13.5px] font-medium">{o.label}</span>
                <span className="block text-[11px] text-neutral-500">{o.hint}</span>
              </span>
              {draftSort === o.key && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-400)" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M5 12.5 10 17.5 19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 text-sm font-semibold">Category</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setDraftCat("all")}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium",
              draftCat === "all" ? "bg-accent-800 text-accent-100" : "bg-neutral-900 text-neutral-400",
            )}
          >
            All
          </button>
          {(Object.keys(CATEGORY_LABELS) as QuestCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setDraftCat(c)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium",
                draftCat === c ? "bg-accent-800 text-accent-100" : "bg-neutral-900 text-neutral-400",
              )}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setSort(draftSort);
            setCategory(draftCat);
            onClose();
          }}
          className="mt-6 grid min-h-[48px] w-full place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow"
        >
          Show {resultCount} quest{resultCount === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}
