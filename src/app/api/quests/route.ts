import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUEST_CATEGORIES, PROOF_TYPES } from "@/lib/constants";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 60) || "quest";
}

function validate(body: Record<string, unknown>):
  | { ok: false; reason: string }
  | { ok: true; data: Record<string, unknown> } {
  const title = String(body.title ?? "").trim();
  const category = String(body.category ?? "");
  const reward_points = Number(body.reward_points);
  const proof_type = String(body.proof_type ?? "");
  const description = String(body.description ?? "").trim();
  const effort_minutes = Number(body.effort_minutes);
  const effort_dots = Number(body.effort_dots);
  const min_tier = Number(body.min_tier);
  const slots_total = body.slots_total === null || body.slots_total === "" ? null : Number(body.slots_total);
  const status = String(body.status ?? "draft");

  if (title.length < 4) return { ok: false, reason: "Title too short (4+ chars)" };
  if (!QUEST_CATEGORIES.includes(category as never)) return { ok: false, reason: "Invalid category" };
  if (!PROOF_TYPES.includes(proof_type as never)) return { ok: false, reason: "Invalid proof type" };
  if (!(reward_points > 0 && reward_points % 10 === 0)) return { ok: false, reason: "Reward must be a positive multiple of 10" };
  if (description.length < 20) return { ok: false, reason: "Description too short (20+ chars)" };
  if (!(effort_minutes >= 1 && effort_minutes <= 600)) return { ok: false, reason: "Effort minutes 1–600" };
  if (![1, 2, 3].includes(effort_dots)) return { ok: false, reason: "Effort dots 1–3" };
  if (![0, 1, 2].includes(min_tier)) return { ok: false, reason: "Min tier 0–2" };
  if (slots_total !== null && (!(slots_total >= 0) || !Number.isInteger(slots_total)))
    return { ok: false, reason: "Slots must be a whole number or empty" };
  if (!["draft", "live", "paused", "closed"].includes(status)) return { ok: false, reason: "Invalid status" };

  const instructions = Array.isArray(body.instructions)
    ? body.instructions.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (instructions.length === 0) return { ok: false, reason: "Add at least one instruction step" };

  const data: Record<string, unknown> = {
    title,
    category,
    reward_points,
    proof_type,
    description,
    instructions,
    effort_minutes,
    effort_dots,
    min_tier,
    slots_total,
    status,
    options: Array.isArray(body.options) ? body.options.map((s) => String(s).trim()).filter(Boolean) : [],
    questions: Array.isArray(body.questions) ? body.questions : [],
    starts_at: body.starts_at ? new Date(String(body.starts_at)).toISOString() : null,
    ends_at: body.ends_at ? new Date(String(body.ends_at)).toISOString() : null,
  };
  return { ok: true, data };
}

async function isAdmin(request: Request): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin === true;
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const v = validate(body);
  if (!v.ok) return NextResponse.json({ ok: false, reason: v.reason }, { status: 422 });

  const admin = createAdminClient();
  const slug = `${slugify(String(body.title))}-${Date.now().toString(36)}`;
  const { data, error } = await admin
    .from("quests")
    .insert({ ...v.data, slug })
    .select("id, slug")
    .single();
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, slug: data.slug });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });

  // Merge the patch onto the existing row, then full-validate the result.
  const admin = createAdminClient();
  const { data: existing } = await admin.from("quests").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });

  const merged: Record<string, unknown> = { ...existing, ...body };
  const v = validate(merged);
  if (!v.ok) return NextResponse.json({ ok: false, reason: v.reason }, { status: 422 });

  const { error } = await admin.from("quests").update(v.data).eq("id", id);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
