import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/verification — admin-only ID review. Gate enforced here + in SQL.
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
    requestId?: string;
    action?: "approve" | "reject";
    note?: string;
  };
  if (!body.requestId || !body.action) {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  // User-session client: RPC derives the admin from auth.uid().
  const { data, error } = await supabase.rpc("review_verification", {
    p_request_id: body.requestId,
    p_action: body.action,
    p_note: body.note ?? null,
  });
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  const result = data as { ok: boolean; reason?: string };
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
