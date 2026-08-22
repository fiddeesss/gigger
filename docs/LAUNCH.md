# PisoQuest — Launch Runbook

What it takes to go from "working in dev" to "real users". Everything in this
doc is either done or a small task with the exact steps.

## ✅ Done (verified live)
- Full user loop: signup (email OTP) → quest feed → submit (6 proof types) → human review (≤24h SLA) → wallet credit on approval → redeem (GCash/Maya/load) → manual payout queue → receipt
- Admin: review queue (keyboard-first), payout queue, ID verification queue, quest CRUD, user standing
- Invites: ₱10 both sides on first approved quest, 10/mo cap, self-invite blocked
- Security: admin gates inside SQL RPCs (self-approve/self-pay impossible), column-level RLS (no self-promotion), storage folder isolation, escrow-at-payout
- Tests: 51 unit + phase smoke suites (5/6/7/8) — run with `npm run smoke`

## 🔧 Before launch (each needs one account/decision from Fides)

### 1. Domain
- Buy `pisoquest.ph` (or `.com`) — recommended: `.ph` for trust + local SEO.
- Wire to Vercel once deployed.

### 2. Deploy
- Vercel project from `github.com/fiddeesss/gigger` (import → framework Next.js auto-detected).
- Env vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Rotate the service_role key first** — it was shared in chat: Supabase → Settings → API → Roll service_role key → update `.env.local` + Vercel. Also rotate the Supabase access token if it ever leaks.
- Supabase: upgrade to Pro ($25/mo) for backups + higher SMTP rate limits.
- `npm run build` locally passes; CI (GitHub Actions) can be added later.

### 3. Email (OTP deliverability)
- Create a **Resend** account, verify the domain.
- Supabase → Auth → SMTP settings: host `smtp.resend.com`, port 465, user `resend`, pass = Resend API key, sender `PisoQuest <no-reply@pisoquest.ph>`.
- Test: sign up with a Gmail + a Globe/Smart address. Default Supabase SMTP is rate-limited (~2-4/hr) — do NOT launch on it.

### 4. Analytics + errors
- **Plausible** (privacy-friendly) — add script to `layout.tsx` once domain is live.
- **Sentry** — create project, add `SENTRY_DSN` + `@sentry/nextjs` (or defer; keep an eye on Vercel function logs initially).

### 5. Legal
- Terms, privacy, payout-terms pages are **built** (`/terms`, `/privacy`, `/payout-terms`) — have them skimmed before launch. Add the terms links to the landing footer + login page.

### 6. Content / ops
- Seed real quests via `/admin/quests` (admin account: create yourself via signup, then
  `UPDATE profiles SET is_admin = true WHERE email = '...'` in the SQL editor).
- Support inbox: `support@pisoquest.app` → forward to Fides.
- Backup: Supabase Pro daily backups on; optionally nightly `pg_dump` to a private bucket (script under `scripts/` can be added).

## 🧭 Admin daily ops checklist (once live)
1. **Reviews** (`/admin/reviews`) — clear under_review first; keep the ≤24h promise. Rejections need a note in your own words (it's quoted back).
2. **Payouts** (`/admin/redemptions`) — pay within 48h of approval: send money out-of-band (GCash app), then click **Paid ✓**. Holds need a reason (user sees it).
3. **IDs** (`/admin/verifications`) — approve within 48h; reject with a reason (user can retry).
4. **Quests** (`/admin/quests`) — keep supply fresh; pause anything broken.
5. **Users** (`/admin/users`) — search, restrict/suspend with reasons. Suspended = can't submit/redeem; balance held, never confiscated.

## 🚨 Incident notes
- Double-pay/over-credit: ledger is immutable — add a negative `adjustment` row via SQL rather than editing history.
- OTP delivery issues: check Resend logs + bounce rate; consider SMS fallback later (Semaphore/Synacy).
- Fraud wave: flag signal → second review; restrict accounts; tighten referral rules.

## Post-launch v1.1 candidates
- Leaderboard (designed, deferred) · in-app notifications · real GCash/Maya API (needs business registration) · device fingerprinting for referral abuse · SMS OTP fallback · PWA offline queueing for uploads.
