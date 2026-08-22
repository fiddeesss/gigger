// Phase 10 smoke: adversarial-review regressions.
// Proves: forged admin id fails, cross-user redemptions fail, direct table
// inserts fail, non-admin /admin redirects, payload validation is server-side.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  process.env.SUPABASE_ANON_KEY ??= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
} catch {}

const API = "https://aiumavddbmoucvdgtows.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY;
const ADMIN = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = "http://localhost:3100";
const REF = "aiumavddbmoucvdgtows";

async function jf(url, opts = {}) {
  const r = await fetch(url, opts);
  const body = await r.json().catch(() => null);
  return { status: r.status, body };
}
function cookieFor(s) {
  const payload = { access_token: s.access_token, token_type: "bearer", expires_in: 3600, expires_at: s.expires_at, refresh_token: s.refresh_token };
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}
async function sql(q) {
  return jf(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
    body: JSON.stringify({ query: q }),
  });
}
async function createUser(email) {
  return jf(`${API}/auth/v1/admin/users`, { method: "POST", headers: { apikey: ADMIN, Authorization: `Bearer ${ADMIN}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "T3st!pass-2026", email_confirm: true }) });
}
async function signIn(email) {
  return jf(`${API}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "T3st!pass-2026" }) });
}
const clean = (h) => h.replace(/<!-- -->/g, "");
const stamp = Date.now();
const uA = `p10a.${stamp}@pqtest.local`;
const uB = `p10b.${stamp}@pqtest.local`;
const adm = `p10adm.${stamp}@pqtest.local`;
const checks = [];
const check = (n, c, d = "") => checks.push(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

await createUser(uA);
await createUser(uB);
await createUser(adm);
await sql(`update public.profiles set is_admin = true where email = '${adm}'`);
await sql(`update public.profiles set tier = 1, full_name = 'User A' where email = '${uA}'`);
await sql(`update public.profiles set tier = 1, full_name = 'User B' where email = '${uB}'`);
const sA = await signIn(uA);
const sB = await signIn(uB);
const sa = await signIn(adm);
const cA = cookieFor(sA.body);
const cB = cookieFor(sB.body);
const ca = cookieFor(sa.body);
const idA = sA.body.user.id;
const idB = sB.body.user.id;
const idAdm = sa.body.user.id;
const hA = { apikey: ANON, Authorization: `Bearer ${sA.body.access_token}`, "Content-Type": "application/json" };
const hB = { apikey: ANON, Authorization: `Bearer ${sB.body.access_token}`, "Content-Type": "application/json" };

// ---- 1. Finding 1: forged admin id — user self-approves via RPC directly.
// New signature has NO admin id param; auth.uid() is the user → not-admin.
const quest = await sql("select id, reward_points from public.quests where slug = 'jeepney-poll'");
const qid = quest.body[0].id;
const sub = await jf(`${API}/rest/v1/rpc/submit_quest`, { method: "POST", headers: hA, body: JSON.stringify({ p_quest_id: qid, p_user_id: idA, p_payload: { type: "poll", option: "Jeepney" } }) });
check("submission created", sub.body?.ok === true, JSON.stringify(sub.body));
const subId = sub.body.submission_id;

const forged = await jf(`${API}/rest/v1/rpc/review_submission`, { method: "POST", headers: hA, body: JSON.stringify({ p_submission_id: subId, p_action: "approve" }) });
check("forged self-approve blocked (auth.uid gate)", forged.body?.reason === "not-admin", JSON.stringify(forged.body));

// Old signature (with p_reviewer_id) must not exist anymore — and if it
// does (overload leak), it must NOT approve. PostgREST returns HTTP 200 for
// {ok:false} RPC results, so assert on the body, not the status.
const oldSig = await jf(`${API}/rest/v1/rpc/review_submission`, { method: "POST", headers: hA, body: JSON.stringify({ p_submission_id: subId, p_reviewer_id: idAdm, p_action: "approve" }) });
check("old admin-id signature gone", oldSig.body?.ok !== true, JSON.stringify(oldSig.body));

// ---- 2. Finding 2: cross-user redemption — A tries to drain B
await sql(`insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note) values ('${idB}', 20000, 'quest_reward', null, 'seed')`);
const cross = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: hA, body: JSON.stringify({ p_user_id: idB, p_points: 10000, p_method: "gcash", p_account: { number: "09170000000" } }) });
check("cross-user redemption blocked", cross.body?.reason === "forbidden", JSON.stringify(cross.body));

// ---- 3. Finding 5: direct table inserts revoked
const directRed = await jf(`${API}/rest/v1/redemptions`, { method: "POST", headers: hA, body: JSON.stringify({ user_id: idA, points: 100, peso: 9999.99, method: "gcash", account: {}, status: "paid_out", reference_no: "PQ-HACKED" }) });
check("direct redemption insert blocked", directRed.status >= 400, `status ${directRed.status}`);
const directSub = await jf(`${API}/rest/v1/submissions`, { method: "POST", headers: hA, body: JSON.stringify({ quest_id: qid, user_id: idA, payload: {}, status: "approved" }) });
check("direct submission insert blocked", directSub.status >= 400, `status ${directSub.status}`);

// ---- 4. Finding 3: non-admin cannot read admin pages (edge + layout)
const adminPage = await fetch(`${BASE}/admin/redemptions`, { headers: { Cookie: cA }, redirect: "manual" });
check("non-admin /admin redirects", adminPage.status === 307 || adminPage.status === 302, `status ${adminPage.status}`);
const adminApi = await fetch(`${BASE}/api/payout`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cA }, body: JSON.stringify({ redemptionId: "00000000-0000-0000-0000-000000000000", action: "pay" }) });
check("non-admin payout API blocked", adminApi.status === 403, adminApi.status);

// ---- 5. Finding 9: server-side payload validation
const garbage = await jf(`${API}/rest/v1/rpc/submit_quest`, { method: "POST", headers: hA, body: JSON.stringify({ p_quest_id: qid, p_user_id: idA, p_payload: { type: "poll", option: "NOT AN OPTION" } }) });
check("poll option validated server-side", garbage.body?.reason === "bad-payload", JSON.stringify(garbage.body));
const oversized = await jf(`${API}/rest/v1/rpc/submit_quest`, { method: "POST", headers: hA, body: JSON.stringify({ p_quest_id: qid, p_user_id: idA, p_payload: { type: "text", text: "x".repeat(99999) } }) });
check("oversized payload blocked", oversized.body?.reason === "bad-payload", JSON.stringify(oversized.body));

// ---- 6. Legit admin flow still works end-to-end
const approve = await fetch(`${BASE}/api/review`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ submissionId: subId, action: "approve" }) });
check("legit admin approve still works", (await approve.json()).ok === true, "");
const bal = await sql(`select coalesce(sum(delta_points),0) as b from public.wallet_ledger where user_id = '${idA}'`);
check("reward credited via new path", Number(bal.body[0].b) === 100, JSON.stringify(bal.body[0]));

await sql(`delete from auth.users where email in ('${uA}','${uB}','${adm}')`);
console.log(checks.join("\n"));
const failed = checks.filter((c) => c.startsWith("FAIL")).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
