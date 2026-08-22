"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Quest } from "@/lib/types";
import { QUEST_CATEGORIES, PROOF_TYPES } from "@/lib/constants";
import { CATEGORY_LABELS } from "@/lib/quests";

interface QuestDraft {
  title: string;
  category: string;
  reward_points: number;
  proof_type: string;
  description: string;
  instructions: string[];
  options: string[];
  questions: { q: string; type: "single" | "text"; options: string }[];
  effort_minutes: number;
  effort_dots: number;
  min_tier: number;
  slots_total: string;
  status: string;
  starts_at: string;
  ends_at: string;
}

function fromQuest(q: Quest): QuestDraft {
  return {
    title: q.title,
    category: q.category,
    reward_points: q.reward_points,
    proof_type: q.proof_type,
    description: q.description,
    instructions: q.instructions,
    options: q.options ?? [],
    questions: (q.questions ?? []).map((x) => ({
      q: x.q,
      type: x.type,
      options: (x.options ?? []).join(", "),
    })),
    effort_minutes: q.effort_minutes,
    effort_dots: q.effort_dots,
    min_tier: q.min_tier,
    slots_total: q.slots_total === null ? "" : String(q.slots_total),
    status: q.status,
    starts_at: q.starts_at ? q.starts_at.slice(0, 16) : "",
    ends_at: q.ends_at ? q.ends_at.slice(0, 16) : "",
  };
}

export function QuestForm({ quest }: { quest?: Quest }) {
  const router = useRouter();
  const [d, setD] = useState<QuestDraft>(quest ? fromQuest(quest) : {
    title: "", category: "survey", reward_points: 100, proof_type: "survey",
    description: "", instructions: [""], options: [], questions: [],
    effort_minutes: 10, effort_dots: 1, min_tier: 0, slots_total: "",
    status: "draft", starts_at: "", ends_at: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof QuestDraft>(k: K, v: QuestDraft[K]) {
    setD((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const payload = {
      ...d,
      reward_points: Number(d.reward_points),
      effort_minutes: Number(d.effort_minutes),
      effort_dots: Number(d.effort_dots),
      min_tier: Number(d.min_tier),
      slots_total: d.slots_total === "" ? null : Number(d.slots_total),
      instructions: d.instructions.map((s) => s.trim()).filter(Boolean),
      options: d.options.map((s) => s.trim()).filter(Boolean),
      questions: d.questions
        .filter((x) => x.q.trim())
        .map((x) => ({
          q: x.q.trim(),
          type: x.type,
          options: x.type === "single" ? x.options.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        })),
      starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
      ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
    };

    const res = await fetch("/api/quests", {
      method: quest ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quest ? { ...payload, id: quest.id } : payload),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!body.ok) {
      setError(body.reason ?? "Couldn't save — try again.");
      return;
    }
    router.push("/admin/quests");
    router.refresh();
  }

  const inputCls = "min-h-[44px] rounded-lg border border-divider bg-surface px-3.5 text-[14px] outline-none placeholder:text-neutral-600 focus:border-accent";
  const labelCls = "text-[12px] font-medium text-neutral-400";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Title</label>
        <input className={inputCls} value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Rate 10 food delivery apps" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={d.category} onChange={(e) => set("category", e.target.value)}>
            {QUEST_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Proof type</label>
          <select className={inputCls} value={d.proof_type} onChange={(e) => set("proof_type", e.target.value)}>
            {PROOF_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Reward (pts, multiple of 10)</label>
          <input type="number" step={10} className={inputCls} value={d.reward_points} onChange={(e) => set("reward_points", Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Min tier</label>
          <select className={inputCls} value={d.min_tier} onChange={(e) => set("min_tier", Number(e.target.value))}>
            <option value={0}>0 — anyone</option>
            <option value={1}>1 — profile complete</option>
            <option value={2}>2 — ID verified</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Effort (min)</label>
          <input type="number" className={inputCls} value={d.effort_minutes} onChange={(e) => set("effort_minutes", Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Effort dots</label>
          <select className={inputCls} value={d.effort_dots} onChange={(e) => set("effort_dots", Number(e.target.value))}>
            <option value={1}>●○○</option><option value={2}>●●○</option><option value={3}>●●●</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Slots (empty = ∞)</label>
          <input type="number" className={inputCls} value={d.slots_total} onChange={(e) => set("slots_total", e.target.value)} placeholder="∞" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Description (20+ chars)</label>
        <textarea rows={3} className={`${inputCls} min-h-[80px]`} value={d.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Instructions (steps users must follow)</label>
        {d.instructions.map((step, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputCls}
              value={step}
              onChange={(e) => set("instructions", d.instructions.map((s, j) => (j === i ? e.target.value : s)))}
              placeholder={`Step ${i + 1}`}
            />
            <button type="button" onClick={() => set("instructions", d.instructions.filter((_, j) => j !== i))} className="flex-none rounded-lg bg-bad-bg px-3 text-bad">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => set("instructions", [...d.instructions, ""])} className="self-start rounded-lg bg-neutral-900 px-3 py-2 text-[12px] font-medium text-neutral-300">
          + Add step
        </button>
      </div>

      {d.proof_type === "poll" && (
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Poll options</label>
          {d.options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input className={inputCls} value={opt} onChange={(e) => set("options", d.options.map((s, j) => (j === i ? e.target.value : s)))} placeholder={`Option ${i + 1}`} />
              <button type="button" onClick={() => set("options", d.options.filter((_, j) => j !== i))} className="flex-none rounded-lg bg-bad-bg px-3 text-bad">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => set("options", [...d.options, ""])} className="self-start rounded-lg bg-neutral-900 px-3 py-2 text-[12px] font-medium text-neutral-300">
            + Add option
          </button>
        </div>
      )}

      {d.proof_type === "survey" && (
        <div className="flex flex-col gap-3">
          <label className={labelCls}>Survey questions</label>
          {d.questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-3">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={q.q}
                  onChange={(e) => set("questions", d.questions.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                  placeholder={`Question ${i + 1}`}
                />
                <select
                  className={inputCls}
                  value={q.type}
                  onChange={(e) => set("questions", d.questions.map((x, j) => (j === i ? { ...x, type: e.target.value as "single" | "text" } : x)))}
                >
                  <option value="single">Multiple choice</option>
                  <option value="text">Free text</option>
                </select>
                <button type="button" onClick={() => set("questions", d.questions.filter((_, j) => j !== i))} className="flex-none rounded-lg bg-bad-bg px-3 text-bad">✕</button>
              </div>
              {q.type === "single" && (
                <input
                  className={inputCls}
                  value={q.options}
                  onChange={(e) => set("questions", d.questions.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))}
                  placeholder="Options, comma-separated"
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => set("questions", [...d.questions, { q: "", type: "single", options: "" }])}
            className="self-start rounded-lg bg-neutral-900 px-3 py-2 text-[12px] font-medium text-neutral-300"
          >
            + Add question
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={d.status} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">Draft</option>
            <option value="live">Live</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Starts (optional)</label>
          <input type="datetime-local" className={inputCls} value={d.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
        </div>
      </div>

      {error && <p className="rounded-lg bg-bad-bg px-3.5 py-3 text-[12.5px] text-bad">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="grid min-h-[48px] place-items-center rounded-lg bg-section text-[15px] font-medium text-white hover:bg-section-glow disabled:opacity-45"
      >
        {busy ? "Saving…" : quest ? "Save changes" : "Create quest"}
      </button>
    </form>
  );
}
