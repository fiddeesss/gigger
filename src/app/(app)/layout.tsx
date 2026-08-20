import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: ledger }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("wallet_ledger")
      .select("delta_points")
      .eq("user_id", user.id),
  ]);

  const balancePts = (ledger ?? []).reduce((sum, row) => sum + (row.delta_points ?? 0), 0);

  return (
    <AppShell balancePts={balancePts}>{children}</AppShell>
  );
}
