-- Fix: DB-generated referral codes must use the app's validator alphabet.
-- The trigger used hex (uuid substrings) which can contain 0/1 — the app
-- validator rejects those, so such codes could never be used by anyone.

-- Shared alphabet: A-Z minus I,O plus 2-9 (32 chars, no 0/1/O/I)
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
    code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32))::int + 1, 1), '')
      from generate_series(1, 4)
    ) || '-' || (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32))::int + 1, 1), '')
      from generate_series(1, 4)
    );
    begin
      insert into public.profiles (id, email, referral_code)
      values (new.id, new.email, code);
      exit;
    exception when unique_violation then
      if attempts >= 5 then
        code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32))::int + 1, 1), '') from generate_series(1, 4))
                || '-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32))::int + 1, 1), '') from generate_series(1, 4));
        insert into public.profiles (id, email, referral_code) values (new.id, new.email, code);
        exit;
      end if;
    end;
  end loop;
  return new;
end;
$$;

-- Re-key existing profiles whose codes contain validator-rejected characters
do $$
declare
  r record;
  new_code text;
begin
  for r in select id from public.profiles
           where referral_code !~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'
  loop
    loop
      new_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32))::int + 1, 1), '') from generate_series(1, 4))
                  || '-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32))::int + 1, 1), '') from generate_series(1, 4));
      begin
        update public.profiles set referral_code = new_code where id = r.id;
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
  end loop;
end $$;
