import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyReferral } from "@/lib/onboarding";

// POST /api/onboarding — called after OTP-box login (no redirect happened),
// with the referral code the user carried in from localStorage.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { ref?: string };
  const result = await applyReferral(user.id, user.email ?? "", body.ref ?? null);
  return NextResponse.json(result);
}
