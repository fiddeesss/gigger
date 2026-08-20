-- Phase 7: referral bonus — fires on the invitee's FIRST approved quest.
-- Abuse dies at the design layer (design I2): no bonus for just signing up,
-- cap per month, self-invite blocked at attribution time.

create or replace function public.maybe_credit_invite_bonus(
  p_user_id      uuid,
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
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.referred_by is null then return; end if;

  -- First approved submission only (this one must be the first)
  select not exists (
    select 1 from public.submissions
    where user_id = p_user_id and status = 'approved' and id <> p_submission_id
  ) into v_first;
  if not v_first then return; end if;

  -- Inviter's monthly bonus cap (10/month)
  select count(*) into v_month_cnt from public.invites
    where inviter_id = v_profile.referred_by and status = 'bonus_awarded'
      and created_at >= date_trunc('month', now());
  if v_month_cnt >= 10 then return; end if;

  -- The invite row must exist and still be in 'joined' state
  select id into v_invite_id from public.invites
    where inviter_id = v_profile.referred_by and invitee_id = p_user_id and status = 'joined'
    order by created_at desc limit 1;
  if v_invite_id is null then return; end if;

  update public.invites set status = 'bonus_awarded' where id = v_invite_id;

  insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note)
  values (p_user_id, 1000, 'invite_bonus', v_invite_id,
          'Invite bonus: your first approved quest');

  insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note)
  values (v_profile.referred_by, 1000, 'invite_bonus', v_invite_id,
          'Referral bonus: ' || v_profile.email || ' completed their first quest');
end;
$$;

-- Redefine review_submission so the approve branch hooks the bonus
-- (before the quest_reward row is inserted, so "first approved" sees
-- the pre-approval state via the submissions table anyway).
create or replace function public.review_submission(
  p_submission_id uuid,
  p_reviewer_id   uuid,
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
begin
  if not exists (select 1 from public.profiles where id = p_reviewer_id and is_admin) then
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
    -- referral bonus (invitee's first approval): BEFORE the reward row so
    -- the "first approved submission" check is unambiguous
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
    set status        = v_status,
        review_note   = case when p_action = 'flag' then review_note else p_note end,
        reviewed_by   = p_reviewer_id,
        reviewed_at   = now(),
        points_awarded = v_sub.points_awarded,
        flags         = v_sub.flags
  where id = p_submission_id;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

grant execute on function public.review_submission(uuid, uuid, text, text, text) to authenticated;
