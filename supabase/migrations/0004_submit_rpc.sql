-- Phase 3: quest content columns, atomic submission RPC, storage policies.

-- Poll choices (for proof_type='poll') and survey questions (proof_type='survey')
alter table public.quests
  add column if not exists options  jsonb not null default '[]',
  add column if not exists questions jsonb not null default '[]';

-- ============ submit_quest: all validation + slot accounting in ONE transaction ============
-- Returns jsonb {ok:bool, reason?:string, submission_id?:uuid}
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
begin
  select * into v_quest from public.quests where id = p_quest_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'quest-not-found'); end if;
  if v_quest.status <> 'live' then return jsonb_build_object('ok', false, 'reason', 'not-live'); end if;
  if v_quest.slots_total is not null and v_quest.slots_used >= v_quest.slots_total then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no-profile'); end if;
  if v_profile.tier < v_quest.min_tier then
    return jsonb_build_object('ok', false, 'reason', 'tier');
  end if;
  -- H1: restricted accounts keep earning; suspended accounts cannot submit.
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

-- ============ Storage RLS: users may upload/read only under their own folder ============
create policy "proofs: upload own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "proofs: read own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ids: upload own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ids' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ids: read own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'ids' and (storage.foldername(name))[1] = auth.uid()::text);
