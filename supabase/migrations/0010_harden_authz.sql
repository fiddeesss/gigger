-- Phase 10 hardening — adversarial review fixes.
-- Core principle: SECURITY DEFINER RPCs must derive the actor from auth.uid(),
-- NEVER from client-supplied id parameters. Client-supplied ids are only
-- accepted when they name the TARGET of the operation, and must equal auth.uid().

-- ============================================================
-- 1. Admin RPCs: drop client-supplied admin ids, use auth.uid()
-- ============================================================

-- review_submission(p_submission_id, p_action, p_note, p_signal)
create or replace function public.review_submission(
  p_submission_id uuid,
  p_action        text,
  p_note          text default null,
  p_signal        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub   public.submissions%rowtype;
  v_quest public.quests%rowtype;
  v_status text;
  v_reviewer uuid := auth.uid();
begin
  if v_reviewer is null then return jsonb_build_object('ok', false, 'reason', 'not-admin'); end if;
  if not exists (select 1 from public.profiles where id = v_reviewer and is_admin) then
    return jsonb_build_object('ok', false, 'reason', 'not-admin');
  end if;
  if p_action not in ('approve', 'reject', 'flag') then
    return jsonb_build_object('ok', false, 'reason', 'bad-action');
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not-found'); end if;
  if v_sub.status not in ('under_review', 'flagged') then
    return jsonb_build_object('ok', false, 'reason', 'not-reviewable');
  end if;
  if p_action = 'flag' and v_sub.status = 'flagged' then
    return jsonb_build_object('ok', false, 'reason', 'already-flagged');
  end if;
  if p_action = 'reject' and (p_note is null or length(trim(p_note)) < 10) then
    return jsonb_build_object('ok', false, 'reason', 'note-required');
  end if;

  if p_action = 'approve' then
    v_status := 'approved';
    select * into v_quest from public.quests where id = v_sub.quest_id;
    if v_quest.reward_points is null then
      return jsonb_build_object('ok', false, 'reason', 'quest-missing');
    end if;
    perform public.maybe_credit_invite_bonus(v_sub.user_id, v_sub.id);
    insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note)
    values (v_sub.user_id, v_quest.reward_points, 'quest_reward', v_sub.id,
            'Quest approved: ' || v_quest.title);
    v_sub.points_awarded := v_quest.reward_points;
  elsif p_action = 'reject' then
    v_status := 'rejected';
    update public.quests set slots_used = greatest(0, slots_used - 1)
      where id = v_sub.quest_id;
    v_sub.points_awarded := null;
  else
    v_status := 'flagged';
    v_sub.flags := v_sub.flags || jsonb_build_array(
      jsonb_build_object('signal', p_signal, 'note', p_note)
    );
  end if;

  update public.submissions
    set status         = v_status,
        review_note    = case when p_action = 'flag' then review_note else p_note end,
        reviewed_by    = v_reviewer,
        reviewed_at    = now(),
        points_awarded = v_sub.points_awarded,
        flags          = v_sub.flags
  where id = p_submission_id;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

grant execute on function public.review_submission(uuid, text, text, text) to authenticated;

-- pay_redemption(p_redemption_id, p_action, p_note) — balance re-verified on pay
create or replace function public.pay_redemption(
  p_redemption_id uuid,
  p_action        text,
  p_note          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r       public.redemptions%rowtype;
  v_balance int;
  v_admin   uuid := auth.uid();
begin
  if v_admin is null then return jsonb_build_object('ok', false, 'reason', 'not-admin'); end if;
  if not exists (select 1 from public.profiles where id = v_admin and is_admin) then
    return jsonb_build_object('ok', false, 'reason', 'not-admin');
  end if;
  if p_action not in ('pay', 'hold', 'reject') then
    return jsonb_build_object('ok', false, 'reason', 'bad-action');
  end if;

  select * into v_r from public.redemptions where id = p_redemption_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not-found'); end if;
  if v_r.status not in ('pending', 'on_hold') then
    return jsonb_build_object('ok', false, 'reason', 'not-actionable');
  end if;

  if p_action = 'pay' then
    -- Re-verify the user can actually cover the payout (blocks race-created
    -- over-redemptions from driving the ledger negative).
    select coalesce(sum(delta_points), 0) into v_balance
      from public.wallet_ledger where user_id = v_r.user_id;
    if v_balance < v_r.points then
      return jsonb_build_object('ok', false, 'reason', 'insufficient-balance');
    end if;
    update public.redemptions
      set status = 'paid_out', paid_out_at = now(), reviewed_by = v_admin, admin_note = p_note
      where id = p_redemption_id;
    insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note)
    values (v_r.user_id, -v_r.points, 'redemption', v_r.id,
            'Paid out: ' || v_r.reference_no || ' via ' || v_r.method);
  elsif p_action = 'hold' then
    if p_note is null or length(trim(p_note)) < 5 then
      return jsonb_build_object('ok', false, 'reason', 'hold-reason-required');
    end if;
    update public.redemptions
      set status = 'on_hold', hold_reason = p_note, reviewed_by = v_admin
      where id = p_redemption_id;
  else
    update public.redemptions
      set status = 'rejected', admin_note = p_note, reviewed_by = v_admin
      where id = p_redemption_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.pay_redemption(uuid, text, text) to authenticated;

-- review_verification(p_request_id, p_action, p_note)
create or replace function public.review_verification(
  p_request_id uuid,
  p_action     text,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.verification_requests%rowtype;
  v_admin uuid := auth.uid();
begin
  if v_admin is null then return jsonb_build_object('ok', false, 'reason', 'not-admin'); end if;
  if not exists (select 1 from public.profiles where id = v_admin and is_admin) then
    return jsonb_build_object('ok', false, 'reason', 'not-admin');
  end if;
  if p_action not in ('approve', 'reject') then
    return jsonb_build_object('ok', false, 'reason', 'bad-action');
  end if;

  select * into v_req from public.verification_requests where id = p_request_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not-found'); end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not-pending');
  end if;
  if p_action = 'reject' and (p_note is null or length(trim(p_note)) < 10) then
    return jsonb_build_object('ok', false, 'reason', 'note-required');
  end if;

  if p_action = 'approve' then
    update public.verification_requests
      set status = 'approved', reviewed_by = v_admin, reviewed_at = now(), admin_note = p_note
      where id = p_request_id;
    update public.profiles set tier = 2, updated_at = now() where id = v_req.user_id;
  else
    update public.verification_requests
      set status = 'rejected', reviewed_by = v_admin, reviewed_at = now(), admin_note = p_note
      where id = p_request_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.review_verification(uuid, text, text) to authenticated;

-- set_account_standing(p_user_id, p_standing, p_reason)
create or replace function public.set_account_standing(
  p_user_id  uuid,
  p_standing text,
  p_reason   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles%rowtype;
  v_admin  uuid := auth.uid();
begin
  if v_admin is null then return jsonb_build_object('ok', false, 'reason', 'not-admin'); end if;
  if not exists (select 1 from public.profiles where id = v_admin and is_admin) then
    return jsonb_build_object('ok', false, 'reason', 'not-admin');
  end if;
  if p_standing not in ('good_standing', 'restricted', 'suspended') then
    return jsonb_build_object('ok', false, 'reason', 'bad-standing');
  end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no-profile'); end if;
  if v_target.is_admin then return jsonb_build_object('ok', false, 'reason', 'cannot-touch-admin'); end if;
  if p_standing <> 'good_standing' and (p_reason is null or length(trim(p_reason)) < 5) then
    return jsonb_build_object('ok', false, 'reason', 'reason-required');
  end if;

  update public.profiles set standing = p_standing, updated_at = now() where id = p_user_id;

  update public.account_actions set active = false where user_id = p_user_id and active;
  insert into public.account_actions (user_id, kind, reason, active, created_by)
  values (p_user_id,
          case p_standing when 'suspended' then 'suspension' when 'restricted' then 'restriction' else 'flag' end,
          p_reason, true, v_admin);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.set_account_standing(uuid, text, text) to authenticated;

-- ============================================================
-- 2. User RPCs: assert the caller IS the p_user_id they name
-- ============================================================

-- create_redemption: caller must be the account owner; lock the profile row
create or replace function public.create_redemption(
  p_user_id uuid,
  p_points  int,
  p_method  text,
  p_account jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  public.profiles%rowtype;
  v_balance  int;
  v_pending  numeric;
  v_spent    numeric;
  v_cap      numeric;
  v_min      numeric;
  v_peso     numeric;
  v_ref      text;
  v_id       uuid;
  attempts   int := 0;
begin
  if p_user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  -- Lock the profile row: serializes concurrent redemptions for this user
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no-profile'); end if;
  if v_profile.tier < 1 then return jsonb_build_object('ok', false, 'reason', 'tier'); end if;
  if v_profile.standing = 'suspended' then
    return jsonb_build_object('ok', false, 'reason', 'suspended');
  end if;
  if p_method not in ('gcash', 'maya', 'load') then
    return jsonb_build_object('ok', false, 'reason', 'bad-method');
  end if;
  if p_points <= 0 or p_points % 10 <> 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad-amount');
  end if;
  if p_method in ('gcash', 'maya') and nullif(p_account->>'number', '') is null then
    return jsonb_build_object('ok', false, 'reason', 'bad-account');
  end if;
  if p_method = 'load' and (nullif(p_account->>'number', '') is null or nullif(p_account->>'network', '') is null) then
    return jsonb_build_object('ok', false, 'reason', 'bad-account');
  end if;

  v_peso := p_points::numeric / 100;
  v_min := case when p_method = 'load' then 10 else 100 end;
  if v_peso < v_min then return jsonb_build_object('ok', false, 'reason', 'below-minimum'); end if;

  select coalesce(sum(delta_points), 0) into v_balance
    from public.wallet_ledger where user_id = p_user_id;
  select coalesce(sum(r.peso), 0) into v_pending
    from public.redemptions r
    where r.user_id = p_user_id and r.status in ('pending', 'on_hold');
  if v_peso > (v_balance::numeric / 100) - v_pending then
    return jsonb_build_object('ok', false, 'reason', 'insufficient');
  end if;

  v_cap := case when v_profile.tier = 2 then 5000 else 500 end;
  select coalesce(sum(r.peso), 0) into v_spent
    from public.redemptions r
    where r.user_id = p_user_id
      and r.status in ('pending', 'on_hold', 'paid_out')
      and r.created_at >= ((now() + interval '8 hours')::date - interval '8 hours');
  if v_spent + v_peso > v_cap then
    return jsonb_build_object('ok', false, 'reason', 'daily-cap');
  end if;

  loop
    attempts := attempts + 1;
    v_ref := 'PQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.redemptions (user_id, points, peso, method, account, reference_no)
      values (p_user_id, p_points, v_peso, p_method, p_account, v_ref)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if attempts >= 5 then
        v_ref := 'PQ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        insert into public.redemptions (user_id, points, peso, method, account, reference_no)
        values (p_user_id, p_points, v_peso, p_method, p_account, v_ref)
        returning id into v_id;
        exit;
      end if;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'redemption_id', v_id, 'reference_no', v_ref);
end;
$$;

grant execute on function public.create_redemption(uuid, int, text, jsonb) to authenticated;

-- submit_quest: caller must be the submitter; payload validated server-side
create or replace function public.submit_quest(
  p_quest_id uuid,
  p_user_id  uuid,
  p_payload  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quest   public.quests%rowtype;
  v_profile public.profiles%rowtype;
  v_existing uuid;
  v_id      uuid;
  v_len     int;
begin
  if p_user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_payload is null or length(p_payload::text) > 10000 then
    return jsonb_build_object('ok', false, 'reason', 'bad-payload');
  end if;

  select * into v_quest from public.quests where id = p_quest_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'quest-not-found'); end if;
  if v_quest.status <> 'live' then return jsonb_build_object('ok', false, 'reason', 'not-live'); end if;
  if v_quest.slots_total is not null and v_quest.slots_used >= v_quest.slots_total then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  -- Server-side payload validation per proof type (mirrors lib/submissions.ts)
  if v_quest.proof_type = 'photo' then
    if jsonb_typeof(p_payload->'urls') <> 'array'
       or jsonb_array_length(p_payload->'urls') < 1
       or jsonb_array_length(p_payload->'urls') > 4
       or (select bool_and(jsonb_typeof(x) = 'string' and length(x #>> '{}') between 1 and 500)
           from jsonb_array_elements(p_payload->'urls') x) is not true then
      return jsonb_build_object('ok', false, 'reason', 'bad-payload');
    end if;
  elsif v_quest.proof_type = 'video' then
    if jsonb_typeof(p_payload->'url') <> 'string'
       or length(nullif(p_payload->>'url', '')) not between 1 and 500 then
      return jsonb_build_object('ok', false, 'reason', 'bad-payload');
    end if;
  elsif v_quest.proof_type = 'text' then
    if jsonb_typeof(p_payload->'text') <> 'string'
       or length(nullif(p_payload->>'text', '')) not between 1 and 2000 then
      return jsonb_build_object('ok', false, 'reason', 'bad-payload');
    end if;
  elsif v_quest.proof_type = 'poll' then
    if jsonb_typeof(p_payload->'option') <> 'string'
       or length(nullif(p_payload->>'option', '')) not between 1 and 200 then
      return jsonb_build_object('ok', false, 'reason', 'bad-payload');
    end if;
    if jsonb_array_length(v_quest.options) > 0
       and not (p_payload->>'option' in (select jsonb_array_elements_text(v_quest.options))) then
      return jsonb_build_object('ok', false, 'reason', 'bad-payload');
    end if;
  elsif v_quest.proof_type = 'survey' then
    if jsonb_typeof(p_payload->'answers') <> 'array'
       or jsonb_array_length(p_payload->'answers') < 1
       or jsonb_array_length(p_payload->'answers') > 30
       or (select bool_and(
             jsonb_typeof(x->'q') = 'string' and length(x->>'q') between 1 and 200
             and jsonb_typeof(x->'a') = 'string' and length(x->>'a') between 1 and 500)
           from jsonb_array_elements(p_payload->'answers') x) is not true then
      return jsonb_build_object('ok', false, 'reason', 'bad-payload');
    end if;
  elsif v_quest.proof_type = 'labels' then
    if jsonb_typeof(p_payload->'labels') <> 'array'
       or jsonb_array_length(p_payload->'labels') < 1
       or jsonb_array_length(p_payload->'labels') > 20
       or (select bool_and(jsonb_typeof(x) = 'string' and length(x #>> '{}') between 1 and 200)
           from jsonb_array_elements(p_payload->'labels') x) is not true then
      return jsonb_build_object('ok', false, 'reason', 'bad-payload');
    end if;
  else
    return jsonb_build_object('ok', false, 'reason', 'bad-payload');
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no-profile'); end if;
  if v_profile.tier < v_quest.min_tier then
    return jsonb_build_object('ok', false, 'reason', 'tier');
  end if;
  if v_profile.standing = 'suspended' then
    return jsonb_build_object('ok', false, 'reason', 'suspended');
  end if;

  select id into v_existing from public.submissions
    where quest_id = p_quest_id and user_id = p_user_id;
  if v_existing is not null then
    return jsonb_build_object('ok', false, 'reason', 'already-submitted');
  end if;

  insert into public.submissions (quest_id, user_id, payload)
  values (p_quest_id, p_user_id, p_payload)
  returning id into v_id;

  update public.quests set slots_used = slots_used + 1 where id = p_quest_id;

  return jsonb_build_object('ok', true, 'submission_id', v_id);
end;
$$;

grant execute on function public.submit_quest(uuid, uuid, jsonb) to authenticated;

-- complete_profile: caller must be the account owner
create or replace function public.complete_profile(
  p_user_id   uuid,
  p_full_name text,
  p_mobile    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier int;
begin
  if p_user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'name-required');
  end if;
  if p_mobile is null or p_mobile !~ '^09[0-9]{9}$' then
    return jsonb_build_object('ok', false, 'reason', 'mobile-required');
  end if;

  select tier into v_tier from public.profiles where id = p_user_id;
  if v_tier is null then return jsonb_build_object('ok', false, 'reason', 'no-profile'); end if;

  update public.profiles
    set full_name = trim(p_full_name),
        mobile = p_mobile,
        tier = greatest(v_tier, 1),
        updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'tier', greatest(v_tier, 1));
end;
$$;

grant execute on function public.complete_profile(uuid, text, text) to authenticated;

-- submit_verification: caller must be the account owner; photo paths must be
-- inside the caller's own storage folder
create or replace function public.submit_verification(
  p_user_id  uuid,
  p_id_type  text,
  p_id_photo text,
  p_selfie   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_existing uuid;
begin
  if p_user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no-profile'); end if;
  if v_profile.standing = 'suspended' then
    return jsonb_build_object('ok', false, 'reason', 'suspended');
  end if;
  if v_profile.tier >= 2 then
    return jsonb_build_object('ok', false, 'reason', 'already-verified');
  end if;
  if p_id_photo is null or p_selfie is null or p_id_type is null then
    return jsonb_build_object('ok', false, 'reason', 'incomplete');
  end if;
  -- Ownership: paths must live under the caller's own folder
  if p_id_photo not like p_user_id::text || '/%' or p_selfie not like p_user_id::text || '/%' then
    return jsonb_build_object('ok', false, 'reason', 'bad-path');
  end if;

  select id into v_existing from public.verification_requests
    where user_id = p_user_id and status = 'pending';
  if v_existing is not null then
    return jsonb_build_object('ok', false, 'reason', 'pending-exists');
  end if;

  insert into public.verification_requests (user_id, id_type, id_photo_url, selfie_url)
  values (p_user_id, p_id_type, p_id_photo, p_selfie)
  returning id into v_existing;

  return jsonb_build_object('ok', true, 'request_id', v_existing);
end;
$$;

grant execute on function public.submit_verification(uuid, text, text, text) to authenticated;

-- resubmit_submission: the submission being resubmitted must belong to the caller
create or replace function public.resubmit_submission(
  p_submission_id uuid,
  p_user_id       uuid,
  p_payload       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.submissions%rowtype;
begin
  if p_user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not-found'); end if;
  if v_sub.user_id is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if v_sub.status <> 'rejected' then
    return jsonb_build_object('ok', false, 'reason', 'not-rejected');
  end if;

  update public.submissions
    set status = 'under_review',
        payload = p_payload,
        review_note = null,
        reviewed_by = null,
        reviewed_at = null,
        points_awarded = null,
        flags = '[]'
  where id = p_submission_id;

  update public.quests set slots_used = slots_used + 1 where id = v_sub.quest_id;

  return jsonb_build_object('ok', true, 'submission_id', v_sub.id);
end;
$$;

grant execute on function public.resubmit_submission(uuid, uuid, jsonb) to authenticated;

-- ============================================================
-- 3. Referral bonus: serialized + atomic flip + deleted-referrer guard
-- ============================================================
create or replace function public.maybe_credit_invite_bonus(
  p_user_id       uuid,
  p_submission_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile   public.profiles%rowtype;
  v_first     boolean;
  v_month_cnt int;
  v_invite_id uuid;
  v_flipped   int;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.referred_by is null then return; end if;

  -- Serialize per inviter: makes the monthly-cap count + flip atomic
  perform pg_advisory_xact_lock(hashtext('inviter:' || v_profile.referred_by::text));

  -- Inviter still exists? (deleted account would FK-fail the ledger insert
  -- and brick every future approval for this invitee)
  if not exists (select 1 from public.profiles where id = v_profile.referred_by) then
    return;
  end if;

  select not exists (
    select 1 from public.submissions
    where user_id = p_user_id and status = 'approved' and id <> p_submission_id
  ) into v_first;
  if not v_first then return; end if;

  select count(*) into v_month_cnt from public.invites
    where inviter_id = v_profile.referred_by and status = 'bonus_awarded'
      and created_at >= date_trunc('month', now());
  if v_month_cnt >= 10 then return; end if;

  -- Atomic flip: only one concurrent approval can claim the 'joined' row
  update public.invites set status = 'bonus_awarded'
    where inviter_id = v_profile.referred_by
      and invitee_id = p_user_id
      and status = 'joined';
  get diagnostics v_flipped = row_count;
  if v_flipped <> 1 then return; end if;

  select id into v_invite_id from public.invites
    where inviter_id = v_profile.referred_by and invitee_id = p_user_id;

  insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note)
  values (p_user_id, 1000, 'invite_bonus', v_invite_id,
          'Invite bonus: your first approved quest');

  insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note)
  values (v_profile.referred_by, 1000, 'invite_bonus', v_invite_id,
          'Referral bonus: ' || v_profile.email || ' completed their first quest');
end;
$$;

-- ============================================================
-- 4. Direct-write lockdown + invariant constraints
-- ============================================================
revoke insert on public.redemptions from authenticated;
revoke insert on public.submissions from authenticated;
revoke insert, update, delete on public.wallet_ledger from authenticated;

alter table public.redemptions
  add constraint redemptions_peso_check
  check (peso = round(points::numeric / 100, 2));

-- ============================================================
-- 5. Uniqueness backstops (idempotency + anti-pollution)
-- ============================================================
delete from public.invites a using public.invites b
  where a.inviter_id = b.inviter_id and a.invitee_id = b.invitee_id and a.ctid > b.ctid;
create unique index if not exists invites_inviter_invitee_unique
  on public.invites (inviter_id, invitee_id);

delete from public.wallet_ledger a using public.wallet_ledger b
  where a.kind = b.kind and a.ref_id is not null and b.ref_id is not null
    and a.ref_id = b.ref_id and a.ctid > b.ctid;
create unique index if not exists wallet_ledger_kind_ref_unique
  on public.wallet_ledger (kind, ref_id) where ref_id is not null;
