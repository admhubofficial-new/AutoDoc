alter table public.settings
  add column if not exists session_version bigint not null default 1
  check (session_version >= 1);

comment on column public.settings.session_version is
  'Versi sesi aktif. Naik satu saat token diubah agar cookie sesi lama tidak berlaku.';

create or replace function public.record_login_failure(p_key_hash text)
returns table (
  failed_attempts smallint,
  locked_until timestamptz,
  is_locked boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_failed_attempts smallint;
  v_locked_until timestamptz;
  v_now timestamptz := statement_timestamp();
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'Kunci pembatasan percobaan tidak valid.';
  end if;

  insert into public.login_attempts as current_attempt (
    key_hash,
    failed_attempts,
    locked_until,
    updated_at
  )
  values (p_key_hash, 1, null, v_now)
  on conflict (key_hash) do update
  set
    failed_attempts = case
      when current_attempt.locked_until > v_now
        then current_attempt.failed_attempts
      when current_attempt.locked_until is not null
        and current_attempt.locked_until <= v_now
        then 1
      else current_attempt.failed_attempts + 1
    end,
    locked_until = case
      when current_attempt.locked_until > v_now
        then current_attempt.locked_until
      when (
        case
          when current_attempt.locked_until is not null
            and current_attempt.locked_until <= v_now
            then 1
          else current_attempt.failed_attempts + 1
        end
      ) >= 5
        then v_now + interval '15 minutes'
      else null
    end,
    updated_at = v_now
  returning current_attempt.failed_attempts, current_attempt.locked_until
  into v_failed_attempts, v_locked_until;

  return query
  select
    v_failed_attempts,
    v_locked_until,
    coalesce(v_locked_until > v_now, false);
end;
$$;

revoke all on function public.record_login_failure(text)
  from public, anon, authenticated;
grant execute on function public.record_login_failure(text)
  to service_role;

comment on function public.record_login_failure(text) is
  'Atomically records a failed global AutoDoc token attempt and locks for 15 minutes on attempt five.';
