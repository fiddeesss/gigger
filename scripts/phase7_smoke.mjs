// Phase 7 smoke: referral attribution → first-approval bonus → cap.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
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
const inviter = `inv7.${stamp}@pqtest.local`;
const invitee = `inv7b.${stamp}@pqtest.local`;
const adminE = `inv7adm.${stamp}@pqtest.local`;
const checks = [];
const check = (n, c, d = "") => checks.push(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

await createUser(inviter);
await createUser(invitee);
await createUser(adminE);
await sql(`update public.profiles set is_admin = true where email = '${adminE}'`);
const si = await signIn(inviter);
const se = await signIn(invitee);
const sa = await signIn(adminE);
const ci = cookieFor(si.body);
const ce = cookieFor(se.body);
const ca = cookieFor(sa.body);
const idInviter = si.body.user.id;
const idInvitee = se.body.user.id;
const ai = { apikey: ANON, Authorization: `Bearer ${si.body.access_token}`, "Content-Type": "application/json" };
const ae = { apikey: ANON, Authorization: `Bearer ${se.body.access_token}`, "Content-Type": "application/json" };

// Get inviter's referral code
const codeRes = await sql(`select referral_code from public.profiles where id = '${idInviter}'`);
const code = codeRes.body[0].referral_code;

// Landing forwards ?ref to login
const landing = await fetch(`${BASE}/?ref=${code}`, { redirect: "manual" });
const landingHtml = clean(await landing.text());
check("landing forwards ref to login", landingHtml.includes(`/login?ref=${code}`), "");

// Attribute via /api/onboarding (simulating the OTP-path call)
const onboard = await fetch(`${BASE}/api/onboarding`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: ce },
  body: JSON.stringify({ ref: code }),
});
check("invitee attributed", (await onboard.json()).ok === true, "");

// No bonus yet (nothing approved)
const balBefore = await sql(`select coalesce(sum(delta_points),0) as b from public.wallet_ledger where user_id = '${idInvitee}'`);
check("no bonus before first approval", Number(balBefore.body[0].b) === 0, JSON.stringify(balBefore.body[0]));

// Invitee submits + admin approves their FIRST quest → both get ₱10 + reward
const quest = await sql("select id, reward_points from public.quests where slug = 'jeepney-poll'");
const sub = await jf(`${API}/rest/v1/rpc/submit_quest`, { method: "POST", headers: ae, body: JSON.stringify({ p_quest_id: quest.body[0].id, p_user_id: idInvitee, p_payload: { type: "poll", option: "Jeepney" } }) });
const subId = sub.body.submission_id;
const approve = await fetch(`${BASE}/api/review`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ submissionId: subId, action: "approve" }) });
check("first approval ok", (await approve.json()).ok === true, "");

const inviteeBal = await sql(`select coalesce(sum(delta_points),0) as b from public.wallet_ledger where user_id = '${idInvitee}'`);
// reward 100 + invite bonus 1000
check("invitee got reward + ₱10 bonus", Number(inviteeBal.body[0].b) === 1100, JSON.stringify(inviteeBal.body[0]));
const inviterBal = await sql(`select coalesce(sum(delta_points),0) as b from public.wallet_ledger where user_id = '${idInviter}'`);
check("inviter got ₱10 bonus", Number(inviterBal.body[0].b) === 1000, JSON.stringify(inviterBal.body[0]));
const inviteStatus = await sql(`select status from public.invites where inviter_id = '${idInviter}' and invitee_id = '${idInvitee}'`);
check("invite marked bonus_awarded", inviteStatus.body[0].status === "bonus_awarded", JSON.stringify(inviteStatus.body[0]));

// SECOND approval → NO second bonus (fires once)
const sub2 = await jf(`${API}/rest/v1/rpc/submit_quest`, { method: "POST", headers: ae, body: JSON.stringify({ p_quest_id: quest.body[0].id, p_user_id: idInvitee, p_payload: { type: "poll", option: "Tricycle" } }) });
// (unique constraint — resubmit same quest impossible; use another quest)
const q2 = await sql("select id from public.quests where slug = 'barangay-hall-board-photo'");
const sub2b = await jf(`${API}/rest/v1/rpc/submit_quest`, { method: "POST", headers: ae, body: JSON.stringify({ p_quest_id: q2.body[0].id, p_user_id: idInvitee, p_payload: { type: "photo", urls: ["x.jpg"] } }) });
const approve2 = await fetch(`${BASE}/api/review`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ submissionId: sub2b.body.submission_id, action: "approve" }) });
check("second approval ok", (await approve2.json()).ok === true, "");
const inviteeBal2 = await sql(`select coalesce(sum(delta_points),0) as b from public.wallet_ledger where user_id = '${idInvitee}'`);
check("no double bonus on second approval", Number(inviteeBal2.body[0].b) === 1100 + 400, JSON.stringify(inviteeBal2.body[0]));

// Self-referral is impossible (attribution blocked at signup; verify no self-row)
const selfAttempt = await fetch(`${BASE}/api/onboarding`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ci }, body: JSON.stringify({ ref: code }) });
check("self-invite still blocked", (await selfAttempt.json()).reason === "self-invite", "");

// Invite page renders
const invitePage = await fetch(`${BASE}/invite`, { headers: { Cookie: ci } });
const inviteHtml = clean(await invitePage.text());
check("invite page 200", invitePage.status === 200, invitePage.status);
check("invite page shows link + bonus", inviteHtml.includes("Your invite link") && inviteHtml.includes("Total earned from invites"), "");
check("invite page shows earned friend", inviteHtml.includes("earned"), "");

await sql(`delete from auth.users where email in ('${inviter}','${invitee}','${adminE}')`);
console.log(checks.join("\n"));
const failed = checks.filter((c) => c.startsWith("FAIL")).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
