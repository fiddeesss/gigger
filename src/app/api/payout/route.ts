import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/payout — admin-only payout decisions. Admin gate enforced here
// AND inside the pay_redemption RPC.
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
    redemptionId?: string;
    action?: "pay" | "hold" | "reject";
    note?: string;
  };
  if (!body.redemptionId || !body.action) {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("pay_redemption", {
    p_redemption_id: body.redemptionId,
    p_admin_id: user.id,
    p_action: body.action,
    p_note: body.note ?? null,
  });
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  const result = data as { ok: boolean; reason?: string };
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
