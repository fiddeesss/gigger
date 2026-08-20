-- Auto-create a profile row on signup (with a unique referral code).
-- Runs as SECURITY DEFINER so it can write despite RLS.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  attempts int := 0;
begin
  loop
    attempts := attempts + 1;
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
            || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    begin
      insert into public.profiles (id, email, referral_code)
      values (new.id, new.email, code);
      exit;
    exception when unique_violation then
      if attempts >= 5 then
        -- last resort: md5-based code; collision odds are negligible
        code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
                || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
        insert into public.profiles (id, email, referral_code)
        values (new.id, new.email, code);
        exit;
      end if;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- New users can always read their own profile (policy covers it), and the
-- onboarding API needs to update referred_by + tier via the service role.
