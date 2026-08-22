import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/review — admin-only. The admin gate is enforced BOTH here (UI)
// and inside the review_submission RPC (defense in depth).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    submissionId?: string;
    action?: "approve" | "reject" | "flag";
    note?: string;
    signal?: string;
  };
  if (!body.submissionId || !body.action) {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  // Call via the user's session client: the RPC derives the admin from
  // auth.uid() and self-checks is_admin (service role would see NULL uid).
  const { data, error } = await supabase.rpc("review_submission", {
    p_submission_id: body.submissionId,
    p_action: body.action,
    p_note: body.note ?? null,
    p_signal: body.signal ?? null,
  });
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  const result = data as { ok: boolean; reason?: string; status?: string };
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
