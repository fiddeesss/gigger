// Phase 6 smoke: profile completion, verification ladder, standing, and the
// column-level RLS security fix.
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
const u1 = `p6a.${stamp}@pqtest.local`;
const u2 = `p6b.${stamp}@pqtest.local`;
const adm = `p6adm.${stamp}@pqtest.local`;
const checks = [];
const check = (n, c, d = "") => checks.push(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

await createUser(u1);
await createUser(u2);
await createUser(adm);
await sql(`update public.profiles set is_admin = true where email = '${adm}'`);
const s1 = await signIn(u1);
const s2 = await signIn(u2);
const sa = await signIn(adm);
const c1 = cookieFor(s1.body);
const c2 = cookieFor(s2.body);
const ca = cookieFor(sa.body);
const id1 = s1.body.user.id;
const id2 = s2.body.user.id;
const a1 = { apikey: ANON, Authorization: `Bearer ${s1.body.access_token}`, "Content-Type": "application/json" };
const a2 = { apikey: ANON, Authorization: `Bearer ${s2.body.access_token}`, "Content-Type": "application/json" };
const aa = { apikey: ANON, Authorization: `Bearer ${sa.body.access_token}`, "Content-Type": "application/json" };

// ---- SECURITY FIX: user cannot self-promote tier or set is_admin via REST ----
const selfPromote = await jf(`${API}/rest/v1/profiles?id=eq.${id1}`, {
  method: "PATCH",
  headers: a1,
  body: JSON.stringify({ tier: 2 }),
});
check("self-promote tier blocked", selfPromote.status >= 400, `status ${selfPromote.status}`);
const selfAdmin = await jf(`${API}/rest/v1/profiles?id=eq.${id1}`, {
  method: "PATCH",
  headers: a1,
  body: JSON.stringify({ is_admin: true }),
});
check("self-admin blocked", selfAdmin.status >= 400, `status ${selfAdmin.status}`);

// ---- complete_profile → Tier 1 ----
const badName = await jf(`${API}/rest/v1/rpc/complete_profile`, { method: "POST", headers: a1, body: JSON.stringify({ p_user_id: id1, p_full_name: "A", p_mobile: "09175550143" }) });
check("short name rejected", badName.body?.reason === "name-required", JSON.stringify(badName.body));
const complete = await jf(`${API}/rest/v1/rpc/complete_profile`, { method: "POST", headers: a1, body: JSON.stringify({ p_user_id: id1, p_full_name: "Juan Dela Cruz", p_mobile: "09175550143" }) });
check("complete_profile → tier 1", complete.body?.ok === true && complete.body?.tier === 1, JSON.stringify(complete.body));

// ---- submit_verification ----
const v = await jf(`${API}/rest/v1/rpc/submit_verification`, { method: "POST", headers: a1, body: JSON.stringify({ p_user_id: id1, p_id_type: "PhilSys National ID", p_id_photo: `${id1}/id.jpg`, p_selfie: `${id1}/selfie.jpg` }) });
check("verification submitted", v.body?.ok === true, JSON.stringify(v.body));
const vId = v.body.request_id;
const dup = await jf(`${API}/rest/v1/rpc/submit_verification`, { method: "POST", headers: a1, body: JSON.stringify({ p_user_id: id1, p_id_type: "PhilSys National ID", p_id_photo: `${id1}/id2.jpg`, p_selfie: `${id1}/selfie2.jpg` }) });
check("duplicate pending blocked", dup.body?.reason === "pending-exists", JSON.stringify(dup.body));

// ---- admin queue + approve → Tier 2 ----
const queue = await fetch(`${BASE}/admin/verifications`, { headers: { Cookie: ca } });
check("admin verification queue 200", queue.status === 200, queue.status);
const nonAdminReview = await jf(`${API}/rest/v1/rpc/review_verification`, { method: "POST", headers: a1, body: JSON.stringify({ p_request_id: vId, p_admin_id: id1, p_action: "approve" }) });
check("non-admin review blocked", nonAdminReview.body?.reason === "not-admin", JSON.stringify(nonAdminReview.body));
const approve = await fetch(`${BASE}/api/verification`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ requestId: vId, action: "approve" }) });
check("admin approves → tier 2", (await approve.json()).ok === true, "");
const tier2 = await sql(`select tier from public.profiles where id = '${id1}'`);
check("user now tier 2", tier2.body[0].tier === 2, JSON.stringify(tier2.body[0]));
const again = await jf(`${API}/rest/v1/rpc/submit_verification`, { method: "POST", headers: a1, body: JSON.stringify({ p_user_id: id1, p_id_type: "PhilSys National ID", p_id_photo: "x.jpg", p_selfie: "y.jpg" }) });
check("tier 2 cannot resubmit", again.body?.reason === "already-verified", JSON.stringify(again.body));

// ---- reject path for user 2 ----
await jf(`${API}/rest/v1/rpc/complete_profile`, { method: "POST", headers: a2, body: JSON.stringify({ p_user_id: id2, p_full_name: "Maria Santos", p_mobile: "09185550123" }) });
const v2 = await jf(`${API}/rest/v1/rpc/submit_verification`, { method: "POST", headers: a2, body: JSON.stringify({ p_user_id: id2, p_id_type: "Driver's License", p_id_photo: `${id2}/id.jpg`, p_selfie: `${id2}/selfie.jpg` }) });
const v2Id = v2.body.request_id;
const shortNote = await fetch(`${BASE}/api/verification`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ requestId: v2Id, action: "reject", note: "blurry" }) });
check("reject needs 10+ chars", (await shortNote.json()).reason === "note-required", "");
const reject = await fetch(`${BASE}/api/verification`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ requestId: v2Id, action: "reject", note: "ID photo is too blurry to read — retake." }) });
check("reject ok", (await reject.json()).ok === true, "");
const retry = await jf(`${API}/rest/v1/rpc/submit_verification`, { method: "POST", headers: a2, body: JSON.stringify({ p_user_id: id2, p_id_type: "Driver's License", p_id_photo: `${id2}/id2.jpg`, p_selfie: `${id2}/selfie2.jpg` }) });
check("rejected can resubmit", retry.body?.ok === true, JSON.stringify(retry.body));

// ---- standing: restrict then suspend; cannot touch admin ----
const restrict = await fetch(`${BASE}/api/standing`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ userId: id2, standing: "restricted", reason: "Suspicious duplicate submissions" }) });
check("restrict ok", (await restrict.json()).ok === true, "");
const touchAdmin = await fetch(`${BASE}/api/standing`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ userId: (sa.body.user.id), standing: "suspended", reason: "test" }) });
check("cannot suspend admin", (await touchAdmin.json()).reason === "cannot-touch-admin", "");
const nonAdminStand = await fetch(`${BASE}/api/standing`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: c2 }, body: JSON.stringify({ userId: id1, standing: "suspended", reason: "x" }) });
check("non-admin standing blocked", nonAdminStand.status === 403, nonAdminStand.status);

// restricted user can still submit quests (H1: earning stays on)
const qs = await sql("select id from public.quests where slug = 'jeepney-poll'");
const stillCan = await jf(`${API}/rest/v1/rpc/submit_quest`, { method: "POST", headers: a2, body: JSON.stringify({ p_quest_id: qs.body[0].id, p_user_id: id2, p_payload: { type: "poll", option: "Jeepney" } }) });
check("restricted can still submit", stillCan.body?.ok === true, JSON.stringify(stillCan.body));

// suspended cannot redeem
const suspend = await fetch(`${BASE}/api/standing`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ userId: id2, standing: "suspended", reason: "Confirmed abuse pattern" }) });
check("suspend ok", (await suspend.json()).ok === true, "");
const redeemBlocked = await jf(`${API}/rest/v1/rpc/create_redemption`, { method: "POST", headers: a2, body: JSON.stringify({ p_user_id: id2, p_points: 10000, p_method: "gcash", p_account: { number: "09185550123" } }) });
check("suspended cannot redeem", redeemBlocked.body?.reason === "suspended", JSON.stringify(redeemBlocked.body));

// ---- pages render ----
const prof1 = await fetch(`${BASE}/profile`, { headers: { Cookie: c1 } });
const prof1Html = clean(await prof1.text());
check("profile shows Tier 2 badge", prof1Html.includes("Tier 2 · ID Verified"), "");
const prof2 = await fetch(`${BASE}/profile`, { headers: { Cookie: c2 } });
const prof2Html = clean(await prof2.text());
check("profile shows suspension banner", prof2Html.includes("Account suspended"), "");
const verifyPage = await fetch(`${BASE}/profile/verify`, { headers: { Cookie: c1 } });
check("verify page shows tier-2 state", (await verifyPage.text()).includes("You're Tier 2"), "");
const usersPage = await fetch(`${BASE}/admin/users`, { headers: { Cookie: ca } });
const usersHtml = clean(await usersPage.text());
check("admin users lists standing panel", usersHtml.includes("Standing") && usersHtml.includes("Restrict"), "");

await sql(`delete from auth.users where email in ('${u1}','${u2}','${adm}')`);
console.log(checks.join("\n"));
const failed = checks.filter((c) => c.startsWith("FAIL")).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
