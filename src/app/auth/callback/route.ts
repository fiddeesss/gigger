import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { applyReferral } from "@/lib/onboarding";

function isFirstSignIn(user: User): boolean {
  if (!user.last_sign_in_at) return true;
  const created = Date.parse(user.created_at);
  const last = Date.parse(user.last_sign_in_at);
  return Math.abs(last - created) < 5000;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const ref = searchParams.get("ref");
  const next = searchParams.get("next") ?? "/quests";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const firstSignIn = isFirstSignIn(data.user);
      if (ref) await applyReferral(data.user.id, data.user.email ?? "", ref);
      return NextResponse.redirect(
        new URL(firstSignIn ? "/welcome" : next, origin),
      );
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
