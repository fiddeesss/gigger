-- Fix RLS infinite recursion: replace inline admin subqueries with a
-- SECURITY DEFINER is_admin() helper (runs as postgres, bypasses RLS, no recursion).

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles: own read/update, admin all" on public.profiles;
create policy "profiles: own read/update, admin all"
  on public.profiles for select using (auth.uid() = id or public.is_admin());

drop policy if exists "quests: admin all" on public.quests;
create policy "quests: admin all"
  on public.quests for all using (public.is_admin());

drop policy if exists "submissions: own rows, admin all" on public.submissions;
create policy "submissions: own rows, admin all"
  on public.submissions for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "ledger: own, admin all" on public.wallet_ledger;
create policy "ledger: own, admin all"
  on public.wallet_ledger for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "redemptions: own, admin all" on public.redemptions;
create policy "redemptions: own, admin all"
  on public.redemptions for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "invites: own, admin all" on public.invites;
create policy "invites: own, admin all"
  on public.invites for select using (auth.uid() in (inviter_id, invitee_id) or public.is_admin());

drop policy if exists "verifications: own, admin all" on public.verification_requests;
create policy "verifications: own, admin all"
  on public.verification_requests for select using (auth.uid() = user_id or public.is_admin());
