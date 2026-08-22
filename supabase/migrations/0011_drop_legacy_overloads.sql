-- CRITICAL follow-up: CREATE OR REPLACE with a different arg count creates a
-- NEW overload instead of replacing. The old 5-arg review_submission (which
-- trusted client-supplied p_reviewer_id) and the old 4-arg
-- pay_redemption/review_verification/set_account_standing (trusted
-- p_admin_id) were still live and PostgREST matched them when the attacker
-- included the old parameter names. Drop every legacy overload explicitly.

drop function if exists public.review_submission(uuid, uuid, text, text, text);
drop function if exists public.pay_redemption(uuid, uuid, text, text);
drop function if exists public.review_verification(uuid, uuid, text, text);
drop function if exists public.set_account_standing(uuid, uuid, text, text);

-- sanity: only the auth.uid()-derived signatures may remain
do $$
declare
  n int;
begin
  select count(*) into n from pg_proc
    where proname in ('review_submission', 'pay_redemption', 'review_verification', 'set_account_standing')
      and pg_function_is_visible(oid);
  if n <> 4 then
    raise exception 'expected exactly 4 hardened RPCs, found %', n;
  end if;
end $$;
