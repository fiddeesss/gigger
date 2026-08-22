import { test, expect, type BrowserContext } from "@playwright/test";

// Full money loop through the real UI:
// signup-created user → complete profile (Tier 1) → submit poll quest
// → admin approves → wallet credited → redeem ₱100 → receipt.

try {
  process.loadEnvFile(".env.local");
} catch {}

const API = "https://aiumavddbmoucvdgtows.supabase.co";
const REF = "aiumavddbmoucvdgtows";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const stamp = Date.now();
const userEmail = `e2e.${stamp}@pqtest.local`;
const adminEmail = `e2eadm.${stamp}@pqtest.local`;
const pw = "T3st!pass-2026";

async function api(path: string, method: string, body?: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      apikey: token ?? ANON,
      Authorization: `Bearer ${token ?? ANON}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function makeUser(email: string) {
  await api("/auth/v1/admin/users", "POST", { email, password: pw, email_confirm: true }, SERVICE);
  const s = await api("/auth/v1/token?grant_type=password", "POST", { email, password: pw }, SERVICE);
  return s.body as { access_token: string; refresh_token: string; expires_at: number; user: { id: string } };
}

async function seedSession(context: BrowserContext, session: { access_token: string; refresh_token: string; expires_at: number }) {
  const payload = {
    access_token: session.access_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
  };
  const value = `base64-${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  await context.addCookies([
    { name: `sb-${REF}-auth-token`, value, domain: "localhost", path: "/" },
  ]);
}

test.describe.configure({ mode: "serial" });

test("full earn → review → cash-out loop", async ({ browser }) => {
  // Users
  const user = await makeUser(userEmail);
  const admin = await makeUser(adminEmail);
  const mgmt = async (query: string) => {
    const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`mgmt sql failed: ${await res.text()}`);
  };
  await mgmt(`update public.profiles set is_admin = true where email = '${adminEmail}'`);
  // Clean leftovers from previous test runs so the queue is deterministic
  await mgmt(`delete from public.submissions where user_id in (select id from auth.users where email like '%@pqtest.local');`);

  const userCtx = await browser.newContext();
  const adminCtx = await browser.newContext();
  await seedSession(userCtx, user);
  await seedSession(adminCtx, admin);
  const userPage = await userCtx.newPage();
  const adminPage = await adminCtx.newPage();

  // 1. Complete profile → Tier 1 (unlocks cash-out)
  await userPage.goto("/profile");
  await userPage.getByPlaceholder("Full name (as on your ID)").fill("E2E Tester");
  await userPage.getByPlaceholder("Mobile number (09XX XXX XXXX)").fill("09175550143");
  await userPage.getByRole("button", { name: /Unlock Tier 1/ }).click();
  await expect(userPage.getByText("Tier 1 · Verified")).toBeVisible({ timeout: 15000 });

  // 2. Browse feed → open the jeepney poll → submit
  await userPage.goto("/quests");
  await expect(userPage.getByText("Quick poll: jeepney or habal-habal to work?")).toBeVisible();
  await userPage.getByText("Quick poll: jeepney or habal-habal to work?").click();
  await expect(userPage.getByRole("link", { name: "Submit your proof" })).toBeVisible();
  await userPage.getByRole("link", { name: "Submit your proof" }).click();
  await userPage.getByText("Jeepney", { exact: true }).click();
  await userPage.getByRole("button", { name: "Submit your proof" }).click();

  // 3. Confirmation with timeline + deadline
  await expect(userPage.getByRole("heading", { name: "Submitted — under review" })).toBeVisible({ timeout: 15000 });
  await expect(userPage.getByText(/by (today|tomorrow)/)).toBeVisible();

  // 4. Admin approves from the queue (scoped to the E2E user's row)
  await adminPage.goto("/admin/reviews");
  await expect(adminPage.getByRole("link", { name: /E2E Tester/ })).toBeVisible();
  await adminPage.getByRole("link", { name: /E2E Tester/ }).click();
  await adminPage.getByRole("button", { name: "Approve" }).click();
  await expect(adminPage.getByText("Review saved.")).toBeVisible({ timeout: 15000 });

  // 5. User sees approval + balance (seed extra points so a ₱100 redemption is affordable)
  await mgmt(
    `insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note) values ('${user.user.id}', 10000, 'quest_reward', null, 'E2E seed credit');`,
  );
  await userPage.goto("/work");
  await expect(userPage.getByText("Approved", { exact: false }).first()).toBeVisible({ timeout: 15000 });
  await userPage.goto("/wallet");
  await expect(userPage.getByText("10,100 pts").first()).toBeVisible();

  // 6. Redeem ₱100 → receipt with reference
  await userPage.goto("/wallet/redeem");
  await userPage.getByPlaceholder("09XX XXX XXXX").fill("09175550143");
  await userPage.getByRole("button", { name: /Redeem ₱100\.00 to GCash/ }).click();
  await expect(userPage.getByText(/Reference: PQ-[A-Z0-9]{6}/)).toBeVisible({ timeout: 30000 });

  await userCtx.close();
  await adminCtx.close();
});
