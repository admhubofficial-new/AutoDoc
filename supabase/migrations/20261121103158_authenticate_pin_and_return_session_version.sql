create or replace function public.authenticate_access_token(p_token text)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_settings public.settings%rowtype;
begin
  if p_token is null
     or char_length(btrim(p_token)) < 6
     or char_length(btrim(p_token)) > 128 then
    return null;
  end if;

  -- Hold a shared settings-row lock so token rotation cannot race the
  -- verification and the matching session version returned to the app.
  select * into v_settings
  from public.settings
  where id = 1
  for share;

  if not found
     or v_settings.setup_completed_at is null
     or v_settings.token_hash is null then
    return null;
  end if;

  if extensions.crypt(btrim(p_token), v_settings.token_hash)
     <> v_settings.token_hash then
    return null;
  end if;

  return v_settings.session_version;
end;
$$;

revoke all on function public.authenticate_access_token(text)
  from public, anon, authenticated;
grant execute on function public.authenticate_access_token(text)
  to service_role;

comment on function public.authenticate_access_token(text) is
  'Verifies PIN and returns the matching session version while holding a shared settings-row lock to prevent token-rotation races.';
