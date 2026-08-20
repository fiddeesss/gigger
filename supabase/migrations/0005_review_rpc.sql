-- Phase 4: review engine RPCs. Money paths are atomic and admin-gated inside SQL.

-- ============ review_submission: approve | reject | flag ============
-- Approve → status approved + wallet credit (points appear ONLY on approval).
-- Reject  → status rejected + held slot released.
-- Flag    → status flagged + signal recorded; second review required.
-- Admin gate is INSIDE the function — a user cannot self-approve via RPC.
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

-- ============ resubmit_submission: rejection recovery path (design D2) ============
-- Only from 'rejected'. New payload + status back to under_review + slot re-held.
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
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not-found'); end if;
  if v_sub.user_id <> p_user_id then return jsonb_build_object('ok', false, 'reason', 'not-owner'); end if;
  if v_sub.status <> 'rejected' then return jsonb_build_object('ok', false, 'reason', 'not-rejected'); end if;

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
