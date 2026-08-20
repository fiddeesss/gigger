-- Phase 5: redemption RPCs. Escrow-at-payout model:
-- balance = ledger sum; pending redemptions reduce spendable but don't leave
-- the ledger until the admin actually pays (no refunds needed on reject).

-- ============ create_redemption: user requests a payout ============
-- Validates: tier>=1, standing, method min (₱100 gcash/maya, ₱10 load),
-- balance >= requested, daily cap (tier 1 = ₱500, tier 2 = ₱5,000, Manila day).
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
  select * into v_profile from public.profiles where id = p_user_id;
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
  -- account shape
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

-- ============ pay_redemption: admin pays out-of-band, then marks it ============
-- pay   → paid_out + ledger debit (money leaves the balance only NOW)
-- hold  → on_hold with a reason (E5 explainer)
-- reject→ rejected (no ledger row — pending was never part of the balance)
-- Admin gate inside SQL, like review_submission.
create or replace function public.pay_redemption(
  p_redemption_id uuid,
  p_admin_id      uuid,
  p_action        text,
  p_note          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.redemptions%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and is_admin) then
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
    update public.redemptions
      set status = 'paid_out', paid_out_at = now(), reviewed_by = p_admin_id, admin_note = p_note
      where id = p_redemption_id;
    insert into public.wallet_ledger (user_id, delta_points, kind, ref_id, note)
    values (v_r.user_id, -v_r.points, 'redemption', v_r.id,
            'Paid out: ' || v_r.reference_no || ' via ' || v_r.method);
  elsif p_action = 'hold' then
    if p_note is null or length(trim(p_note)) < 5 then
      return jsonb_build_object('ok', false, 'reason', 'hold-reason-required');
    end if;
    update public.redemptions
      set status = 'on_hold', hold_reason = p_note, reviewed_by = p_admin_id
      where id = p_redemption_id;
  else
    update public.redemptions
      set status = 'rejected', admin_note = p_note, reviewed_by = p_admin_id
      where id = p_redemption_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.pay_redemption(uuid, uuid, text, text) to authenticated;
