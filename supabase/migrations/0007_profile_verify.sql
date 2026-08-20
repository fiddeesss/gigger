-- Phase 6: profile security fix + verification + account standing.

-- ============ SECURITY FIX: column-level profile updates ============
-- The "profiles: own update" policy allowed users to change ANY column on
-- their own row (tier, is_admin, standing...). Restrict to safe columns;
-- everything else goes through admin-gated RPCs.
revoke update on public.profiles from authenticated;
grant update (full_name, mobile) on public.profiles to authenticated;

-- ============ complete_profile: user fills name + mobile → auto Tier 1 ============
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

-- ============ submit_verification: ID + selfie → admin queue ============
create or replace function public.submit_verification(
  p_user_id     uuid,
  p_id_type     text,
  p_id_photo    text,
  p_selfie      text
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

-- ============ review_verification: admin approve → Tier 2 ============
create or replace function public.review_verification(
  p_request_id uuid,
  p_admin_id   uuid,
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
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and is_admin) then
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
      set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now(), admin_note = p_note
      where id = p_request_id;
    update public.profiles set tier = 2, updated_at = now() where id = v_req.user_id;
  else
    update public.verification_requests
      set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(), admin_note = p_note
      where id = p_request_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.review_verification(uuid, uuid, text, text) to authenticated;

-- ============ set_account_standing: restrict / suspend / restore ============
-- Admins cannot be touched by this function.
create or replace function public.set_account_standing(
  p_user_id   uuid,
  p_admin_id  uuid,
  p_standing  text,
  p_reason    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and is_admin) then
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
          p_reason, true, p_admin_id);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.set_account_standing(uuid, uuid, text, text) to authenticated;
