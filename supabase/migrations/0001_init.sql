-- PisoQuest initial schema (Supabase/Postgres)
-- Apply via: Supabase dashboard → SQL Editor → paste & run (or `supabase db push`)

create extension if not exists pgcrypto;

-- ============ PROFILES ============
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  full_name     text,
  mobile        text,
  tier          int  not null default 0 check (tier in (0,1,2)),
  standing      text not null default 'good_standing'
                check (standing in ('good_standing','restricted','suspended')),
  referral_code text unique not null,
  referred_by   uuid references public.profiles(id),
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============ QUESTS ============
create table public.quests (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  description   text not null,
  category      text not null check (category in
                ('survey','data_labeling','social_ugc','poll','video_review','photo_task')),
  reward_points int not null check (reward_points > 0),
  proof_type    text not null check (proof_type in
                ('photo','video','text','poll','survey','labels')),
  instructions  jsonb not null default '[]',
  effort_minutes int not null default 10,
  effort_dots   int  not null default 1 check (effort_dots between 1 and 3),
  min_tier      int  not null default 0 check (min_tier in (0,1,2)),
  slots_total   int,
  slots_used    int  not null default 0,
  status        text not null default 'draft' check (status in ('draft','live','paused','closed')),
  is_sponsored  boolean not null default false,
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

-- ============ SUBMISSIONS ============
create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  quest_id      uuid not null references public.quests(id),
  user_id       uuid not null references public.profiles(id),
  payload       jsonb not null,
  status        text not null default 'under_review' check (status in
                ('under_review','approved','rejected','flagged')),
  flags         jsonb not null default '[]',
  review_note   text,
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  points_awarded int,
  created_at    timestamptz not null default now(),
  unique (quest_id, user_id)
);

-- ============ WALLET LEDGER ============
create table public.wallet_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  delta_points  int  not null,
  kind          text not null check (kind in
                ('quest_reward','invite_bonus','redemption','adjustment','refund')),
  ref_id        uuid,
  note          text,
  created_at    timestamptz not null default now()
);

-- ============ REDEMPTIONS ============
create table public.redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  points        int  not null check (points > 0),
  peso          numeric(10,2) not null,
  method        text not null check (method in ('gcash','maya','load')),
  account       jsonb not null,
  status        text not null default 'pending' check (status in
                ('pending','on_hold','paid_out','rejected','cancelled')),
  reference_no  text unique not null,
  hold_reason   text,
  admin_note    text,
  reviewed_by   uuid references public.profiles(id),
  paid_out_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ============ INVITES ============
create table public.invites (
  id            uuid primary key default gen_random_uuid(),
  inviter_id    uuid not null references public.profiles(id),
  invitee_id    uuid references public.profiles(id),
  code          text not null,
  status        text not null default 'sent' check (status in ('sent','joined','bonus_awarded')),
  bonus_points  int not null default 1000,
  created_at    timestamptz not null default now()
);

-- ============ VERIFICATION REQUESTS ============
create table public.verification_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  id_type       text not null,
  id_photo_url  text not null,
  selfie_url    text not null,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note    text,
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ============ ACCOUNT ACTIONS ============
create table public.account_actions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  kind          text not null check (kind in ('flag','restriction','suspension','hold')),
  reason        text not null,
  active        boolean not null default true,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

-- ============ INDEXES ============
create index idx_submissions_status on public.submissions (status, created_at desc);
create index idx_submissions_user   on public.submissions (user_id, created_at desc);
create index idx_ledger_user        on public.wallet_ledger (user_id, created_at desc);
create index idx_redemptions_status on public.redemptions (status, created_at);
create index idx_quests_status      on public.quests (status, starts_at desc);

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.quests enable row level security;
alter table public.submissions enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.redemptions enable row level security;
alter table public.invites enable row level security;
alter table public.verification_requests enable row level security;
alter table public.account_actions enable row level security;

create policy "profiles: own read/update, admin all"
  on public.profiles for select using (auth.uid() = id or (select is_admin from public.profiles where id = auth.uid()));
create policy "profiles: own update"
  on public.profiles for update using (auth.uid() = id);

create policy "quests: live public read"
  on public.quests for select using (status = 'live');
create policy "quests: admin all"
  on public.quests for all using ((select is_admin from public.profiles where id = auth.uid()));

create policy "submissions: own rows, admin all"
  on public.submissions for select using (auth.uid() = user_id or (select is_admin from public.profiles where id = auth.uid()));
create policy "submissions: insert own"
  on public.submissions for insert with check (auth.uid() = user_id);

create policy "ledger: own, admin all"
  on public.wallet_ledger for select using (auth.uid() = user_id or (select is_admin from public.profiles where id = auth.uid()));

create policy "redemptions: own, admin all"
  on public.redemptions for select using (auth.uid() = user_id or (select is_admin from public.profiles where id = auth.uid()));
create policy "redemptions: insert own"
  on public.redemptions for insert with check (auth.uid() = user_id);

create policy "invites: own, admin all"
  on public.invites for select using (auth.uid() in (inviter_id, invitee_id) or (select is_admin from public.profiles where id = auth.uid()));
create policy "invites: insert own"
  on public.invites for insert with check (auth.uid() = inviter_id);

create policy "verifications: own, admin all"
  on public.verification_requests for select using (auth.uid() = user_id or (select is_admin from public.profiles where id = auth.uid()));
create policy "verifications: insert own"
  on public.verification_requests for insert with check (auth.uid() = user_id);

-- Note: admin UPDATE/DELETE on submissions/redemptions/etc. is intentionally NOT granted via
-- table policies; server-side code uses the service role for admin actions (approve/reject/pay).
