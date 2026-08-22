// Phase 8 smoke: admin quest lifecycle (create → publish → pause → close).
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
const userE = `q8.${stamp}@pqtest.local`;
const adminE = `q8adm.${stamp}@pqtest.local`;
const checks = [];
const check = (n, c, d = "") => checks.push(`${c ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);

await createUser(userE);
await createUser(adminE);
await sql(`update public.profiles set is_admin = true where email = '${adminE}'`);
const su = await signIn(userE);
const sa = await signIn(adminE);
const cu = cookieFor(su.body);
const ca = cookieFor(sa.body);

// Non-admin cannot create quests
const nonAdmin = await fetch(`${BASE}/api/quests`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cu }, body: JSON.stringify({ title: "x" }) });
check("non-admin create blocked", nonAdmin.status === 403, nonAdmin.status);

// Invalid payload rejected
const invalid = await fetch(`${BASE}/api/quests`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ title: "Short", category: "survey", reward_points: 7, proof_type: "survey", description: "x", instructions: [], effort_minutes: 0, effort_dots: 5, min_tier: 9 }) });
const invalidBody = await invalid.json();
check("invalid payload rejected", invalid.status === 422, JSON.stringify(invalidBody));

// Admin creates a poll quest (live)
const create = await fetch(`${BASE}/api/quests`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: ca },
  body: JSON.stringify({
    title: "Buko juice or iced coffee?",
    category: "poll",
    reward_points: 150,
    proof_type: "poll",
    description: "One question about your favorite midday drink. Ten seconds, honest answer.",
    instructions: ["Pick your answer", "Optional: add your go-to order"],
    options: ["Buko juice", "Iced coffee", "Both, depends on the day", "Neither"],
    effort_minutes: 2,
    effort_dots: 1,
    min_tier: 0,
    slots_total: null,
    status: "live",
  }),
});
const created = await create.json();
check("admin creates quest", create.status === 200 && created.ok === true, JSON.stringify(created));
const qid = created.id;

// Appears in the feed for a regular user
const feed = await fetch(`${BASE}/quests`, { headers: { Cookie: cu } });
const feedHtml = clean(await feed.text());
check("new quest visible in feed", feedHtml.includes("Buko juice or iced coffee?"), "");

// Quest detail + submit page work with poll options
const detail = await fetch(`${BASE}/quests/${created.slug}`, { headers: { Cookie: cu } });
const detailHtml = clean(await detail.text());
check("detail renders", detail.status === 200 && detailHtml.includes("Buko juice"), detail.status);

// Pause → disappears from feed
const pause = await fetch(`${BASE}/api/quests`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ id: qid, status: "paused" }) });
check("pause ok", (await pause.json()).ok === true, "");
const feed2 = await fetch(`${BASE}/quests`, { headers: { Cookie: cu } });
check("paused quest hidden from feed", !(await feed2.text()).includes("Buko juice or iced coffee?"), "");

// Direct URL of paused quest → notFound
const pausedDetail = await fetch(`${BASE}/quests/${created.slug}`, { headers: { Cookie: cu } });
check("paused quest detail 404", pausedDetail.status === 404, pausedDetail.status);

// Republish → visible again
const repub = await fetch(`${BASE}/api/quests`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: ca }, body: JSON.stringify({ id: qid, status: "live" }) });
check("republish ok", (await repub.json()).ok === true, "");
const feed3 = await fetch(`${BASE}/quests`, { headers: { Cookie: cu } });
check("republished quest visible", (await feed3.text()).includes("Buko juice or iced coffee?"), "");

// Admin list page renders
const list = await fetch(`${BASE}/admin/quests`, { headers: { Cookie: ca } });
const listHtml = clean(await list.text());
check("admin quest list renders", listHtml.includes("Buko juice or iced coffee?") && listHtml.includes("+ New quest"), "");

// Edit page renders
const edit = await fetch(`${BASE}/admin/quests/${qid}/edit`, { headers: { Cookie: ca } });
check("edit page renders", (await edit.text()).includes("Save changes"), "");

await sql(`delete from auth.users where email in ('${userE}','${adminE}')`);
await sql(`delete from public.quests where id = '${qid}'`);
console.log(checks.join("\n"));
const failed = checks.filter((c) => c.startsWith("FAIL")).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
