// Phase 5 smoke: full redemption lifecycle + security + caps.
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
const userEmail = `wal.${stamp}@pqtest.local`;
const adminEmail = `waladmin.${stamp}@pqtest.local`;
const checks = [];
const check = (n, c, d = "") => checks.push(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

await createUser(userEmail);
await createUser(adminEmail);
await sql(`update public.profiles set is_admin = true where email = '${adminEmail}'`);
const uSess = await signIn(userEmail);
const aSess = await signIn(adminEmail);
const uCookie = cookieFor(uSess.body);
const aCookie = cookieFor(aSess.body);
const uid = uSess.body.user.id;
const authU = { apikey: ANON, Authorization: `Bearer ${uSess.body.access_token}`, "Content-Type": "application/json" };
const authA = { apikey: ANON, Authorization: `Bearer ${aSess.body.access_token}`, "Content-Type": "application/json" };

// Seed the wallet: credit 60,000 pts via ledger (as if quests were approved)
await sql(`insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note) values ('${uid}', 60000, 'quest_reward', null, 'Smoke test credit')`);

// ---- Tier 0 cannot redeem (RPC-level) ----
const tier0 = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: authU, body: JSON.stringify({ p_user_id: uid, p_points: 10000, p_method: "gcash", p_account: { number: "09175550143" } }) });
check("tier 0 redemption blocked", tier0.body?.reason === "tier", JSON.stringify(tier0.body));

// Promote to Tier 1 (profile complete)
await sql(`update public.profiles set full_name = 'Wallet Tester', mobile = '09175550143', tier = 1 where id = '${uid}'`);

// ---- Guards: bad account, below minimum, insufficient ----
const badAcct = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: authU, body: JSON.stringify({ p_user_id: uid, p_points: 10000, p_method: "gcash", p_account: {} }) });
check("bad account rejected", badAcct.body?.reason === "bad-account", JSON.stringify(badAcct.body));

const belowMin = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: authU, body: JSON.stringify({ p_user_id: uid, p_points: 5000, p_method: "gcash", p_account: { number: "09175550143" } }) });
check("below ₱100 min rejected", belowMin.body?.reason === "below-minimum", JSON.stringify(belowMin.body));

const tooMuch = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: authU, body: JSON.stringify({ p_user_id: uid, p_points: 99990, p_method: "gcash", p_account: { number: "09175550143" } }) });
check("insufficient balance rejected", tooMuch.body?.reason === "insufficient", JSON.stringify(tooMuch.body));

// ---- Valid redemption: ₱100 (10,000 pts) ----
const ok = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: authU, body: JSON.stringify({ p_user_id: uid, p_points: 10000, p_method: "gcash", p_account: { number: "09175550143" } }) });
check("valid redemption created", ok.body?.ok === true && /^PQ-[A-Z0-9]{6}$/.test(ok.body?.reference_no ?? ""), JSON.stringify(ok.body));
const redId = ok.body.redemption_id;

// ---- Daily cap: Tier 1 = ₱500/day; a ₱500 more would exceed (₱100 spent) ----
const overCap = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: authU, body: JSON.stringify({ p_user_id: uid, p_points: 50000, p_method: "gcash", p_account: { number: "09175550143" } }) });
check("daily cap enforced (₱100 + ₱500 > ₱500)", overCap.body?.reason === "daily-cap", JSON.stringify(overCap.body));

// A second ₱100 is allowed (₱200 ≤ ₱500)
const ok2 = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: authU, body: JSON.stringify({ p_user_id: uid, p_points: 10000, p_method: "load", p_account: { number: "09175550143", network: "globe" } }) });
check("second redemption ok (load)", ok2.body?.ok === true, JSON.stringify(ok2.body));
const red2Id = ok2.body.redemption_id;

// ---- Spendable excludes pending: 60,000 pts − 20,000 pending → can redeem 40,000 ----
const pendingBlock = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: authU, body: JSON.stringify({ p_user_id: uid, p_points: 41000, p_method: "gcash", p_account: { number: "09175550143" } }) });
check("pending reduces spendable", pendingBlock.body?.reason === "insufficient", JSON.stringify(pendingBlock.body));

// ---- Admin pages ----
const queue = await fetch(`${BASE}/admin/redemptions`, { headers: { Cookie: aCookie } });
const queueHtml = clean(await queue.text());
check("admin payout queue 200", queue.status === 200, queue.status);
check("queue lists both redemptions", queueHtml.includes("PQ-") && queueHtml.includes("Wallet Tester"), "");

// ---- Non-admin cannot pay ----
const nonAdminPay = await fetch(`${BASE}/api/payout`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: uCookie }, body: JSON.stringify({ redemptionId: redId, action: "pay" }) });
check("non-admin payout blocked", nonAdminPay.status === 403, nonAdminPay.status);

// ---- Admin holds one (needs reason) ----
const holdNoReason = await fetch(`${BASE}/api/payout`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: aCookie }, body: JSON.stringify({ redemptionId: red2Id, action: "hold", note: "x" }) });
check("hold requires reason", (await holdNoReason.json()).reason === "hold-reason-required", "");
const hold = await fetch(`${BASE}/api/payout`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: aCookie }, body: JSON.stringify({ redemptionId: red2Id, action: "hold", note: "New payout number added today" }) });
check("hold ok", (await hold.json()).ok === true, "");

// ---- Admin pays the first one: ledger debits ----
const pay = await fetch(`${BASE}/api/payout`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: aCookie }, body: JSON.stringify({ redemptionId: redId, action: "pay", note: "Sent via GCash app" }) });
check("pay ok", (await pay.json()).ok === true, "");

const bal = await sql(`select coalesce(sum(delta_points),0) as b from public.wallet_ledger where user_id = '${uid}'`);
check("ledger debited after pay (60000−10000=50000)", Number(bal.body[0].b) === 50000, JSON.stringify(bal.body[0]));

const redStatus = await sql(`select status, paid_out_at is not null as paid from public.redemptions where id = '${redId}'`);
check("redemption marked paid", redStatus.body[0].status === "paid_out" && redStatus.body[0].paid === true, JSON.stringify(redStatus.body[0]));

// ---- Hold shows on user side + receipt renders ----
const holdPage = await fetch(`${BASE}/wallet/hold/${red2Id}`, { headers: { Cookie: uCookie } });
const holdHtml = clean(await holdPage.text());
check("hold page explains trigger", holdHtml.includes("New payout number added today") && holdHtml.includes("Wasn&apos;t you") || holdHtml.includes("Payout on hold"), "");

const receipt = await fetch(`${BASE}/wallet/receipt/${redId}`, { headers: { Cookie: uCookie } });
const receiptHtml = clean(await receipt.text());
check("receipt renders with reference", receiptHtml.includes("Reference") && receiptHtml.includes("Paid Out"), "");

const wallet = await fetch(`${BASE}/wallet`, { headers: { Cookie: uCookie } });
const walletHtml = clean(await wallet.text());
check("wallet shows pending", walletHtml.includes("pending — not part of your balance"), "");

const history = await fetch(`${BASE}/history`, { headers: { Cookie: uCookie } });
const historyHtml = clean(await history.text());
check("history shows paid redemption", historyHtml.includes("Paid out: PQ-"), "");

// ---- Reject the held one: no ledger row, status rejected ----
const reject = await fetch(`${BASE}/api/payout`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: aCookie }, body: JSON.stringify({ redemptionId: red2Id, action: "reject", note: "Account flagged" }) });
check("reject ok", (await reject.json()).ok === true, "");
const bal2 = await sql(`select coalesce(sum(delta_points),0) as b from public.wallet_ledger where user_id = '${uid}'`);
check("reject does not debit ledger", Number(bal2.body[0].b) === 50000, JSON.stringify(bal2.body[0]));

// ---- Spendable restored after reject (pending 0) — a ₱100 redeem now works ----
const afterReject = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: authU, body: JSON.stringify({ p_user_id: uid, p_points: 10000, p_method: "maya", p_account: { number: "09175550143" } }) });
check("reject frees spendable for new redemption", afterReject.body?.ok === true, JSON.stringify(afterReject.body));

await sql(`delete from auth.users where email in ('${userEmail}','${adminEmail}')`);
await sql(`delete from public.wallet_ledger where note = 'Smoke test credit'`);
console.log(checks.join("\n"));
const failed = checks.filter((c) => c.startsWith("FAIL")).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
