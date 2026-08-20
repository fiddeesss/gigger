"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui";

type Step = "email" | "code";

const COOLDOWN_SECONDS = 60;

export default function LoginForm() {
  const router = useRouter();
  const supabaseRef = useRef(createClient());

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const refCode = useRef<string | null>(null);
  const nextPath = useRef<string>("/quests");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    refCode.current = params.get("ref");
    nextPath.current = params.get("next") ?? "/quests";
    if (params.get("error") === "link") {
      setError("That link didn't work. Try entering the code from the email.");
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = supabaseRef.current;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      nextPath.current,
    )}${refCode.current ? `&ref=${refCode.current}` : ""}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (error) {
      setError("Couldn't send the code. Check the email and try again.");
      return;
    }
    setEmail(trimmed);
    setStep("code");
    setCooldown(COOLDOWN_SECONDS);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = supabaseRef.current;
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error || !data.user) {
      const left = 4 - attempts; // bounded inline error, no modal (design A3)
      setError(
        left > 0
          ? `That code didn't match. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "Too many tries. Send a new code.",
      );
      setAttempts((a) => a + 1);
      return;
    }
    // Referral attribution from the OTP path (no redirect happened).
    if (refCode.current) {
      fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: refCode.current }),
      }).catch(() => {});
    }
    const isNew =
      !data.user.last_sign_in_at ||
      Math.abs(
        Date.parse(data.user.last_sign_in_at) - Date.parse(data.user.created_at),
      ) < 5000;
    router.push(isNew ? "/welcome" : nextPath.current);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        {step === "code" && (
          <button
            onClick={() => setStep("email")}
            className="rounded-lg px-3 py-2 text-[13px] text-neutral-500 hover:bg-neutral-900"
          >
            ← Back
          </button>
        )}
      </div>

      {step === "email" ? (
        <form onSubmit={sendCode} className="mt-16 flex flex-col gap-5">
          <div>
            <h1 className="mb-1.5 text-[22px] font-semibold">Your email</h1>
            <p className="text-[13px] text-neutral-400">
              We&apos;ll email you a 6-digit code. This is also where payout
              receipts go.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-neutral-300">
              Email address
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="min-h-[48px] rounded-lg border border-divider bg-surface px-4 text-[16px] outline-none placeholder:text-neutral-600 focus:border-accent"
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-bad">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="grid min-h-[48px] w-full place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow disabled:opacity-45"
          >
            {loading ? "Sending…" : "Send code"}
          </button>

          <div className="flex items-start gap-2 rounded-lg bg-surface p-3 text-[11.5px] leading-relaxed text-neutral-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-400)" strokeWidth="2" className="mt-0.5 flex-none">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            </svg>
            We never ask for your password or your code outside this app.
            Payouts only ever go to accounts you verify.
          </div>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-16 flex flex-col gap-5">
          <div>
            <h1 className="mb-1.5 text-[22px] font-semibold">Enter the code</h1>
            <p className="text-[13px] text-neutral-400">
              Sent to <b className="text-neutral-200">{email}</b> ·{" "}
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-[13px] underline"
              >
                wrong email?
              </button>
            </p>
          </div>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            className="min-h-[56px] rounded-lg border border-divider bg-surface text-center text-[22px] font-semibold tracking-[0.35em] outline-none placeholder:text-neutral-700 focus:border-accent"
          />

          {error && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-bad">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="grid min-h-[48px] w-full place-items-center rounded-lg bg-section text-[15px] font-medium text-white transition-colors hover:bg-section-glow disabled:opacity-45"
          >
            {loading ? "Checking…" : "Verify"}
          </button>

          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-neutral-500">
              {cooldown > 0 ? `Resend in 0:${String(cooldown).padStart(2, "0")}` : "No code yet?"}
            </span>
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={sendCode}
              className="text-accent-400 disabled:opacity-40"
            >
              Send a new code
            </button>
          </div>

          <p className="text-center text-[12px] text-neutral-500">
            Or tap the magic link in the email instead.
          </p>
        </form>
      )}
    </main>
  );
}
