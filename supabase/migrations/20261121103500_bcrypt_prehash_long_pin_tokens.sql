-- bcrypt processes at most 72 bytes. Pre-hash the PIN inside PostgreSQL
-- so all supported 6..128 character inputs affect the bcrypt output.
create or replace function public.verify_access_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select case
    when p_token is null
      or char_length(btrim(p_token)) < 6
      or char_length(btrim(p_token)) > 128
      then false
    else exists (
      select 1
      from public.settings s
      where s.id = 1
        and s.setup_completed_at is not null
        and s.token_hash is not null
        and extensions.crypt(
          encode(extensions.digest(convert_to(btrim(p_token), 'UTF8'), 'sha256'), 'hex'),
          s.token_hash
        ) = s.token_hash
    )
  end;
$$;

create or replace function public.selesaikan_setup_awal_dengan_pin(
  p_token text,
  p_start_sj bigint,
  p_start_bast bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_settings public.settings%rowtype;
  v_unlocked_count integer;
  v_token_pre_hash text;
  v_token_hash text;
begin
  if p_token is null
     or char_length(btrim(p_token)) < 6
     or char_length(btrim(p_token)) > 128 then
    raise exception using errcode = '22023',
      message = 'PIN/token harus berisi 6 sampai 128 karakter.';
  end if;

  if p_start_sj is null or p_start_sj < 1
     or p_start_bast is null or p_start_bast < 1 then
    raise exception using errcode = '22023',
      message = 'Nomor awal SJ dan BAST minimal 1.';
  end if;

  select * into v_settings
  from public.settings
  where id = 1
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'Pengaturan SPPG belum tersedia.';
  end if;

  if v_settings.setup_completed_at is not null
     or v_settings.token_hash is not null then
    raise exception using errcode = '55000',
      message = 'Setup awal sudah pernah diselesaikan.';
  end if;

  if exists (select 1 from public.documents) then
    raise exception using errcode = '55000',
      message = 'Setup awal tidak dapat dilakukan karena dokumen sudah pernah dibuat.';
  end if;

  perform 1
  from public.counters
  order by jenis
  for update;

  select count(*) into v_unlocked_count
  from public.counters
  where jenis in ('SJ', 'BAST') and locked = false;

  if v_unlocked_count <> 2 then
    raise exception using errcode = '55000',
      message = 'Counter SJ dan BAST tidak berada dalam status setup awal.';
  end if;

  v_token_pre_hash := encode(
    extensions.digest(convert_to(btrim(p_token), 'UTF8'), 'sha256'),
    'hex'
  );
  v_token_hash := extensions.crypt(
    v_token_pre_hash,
    extensions.gen_salt('bf', 12)
  );

  update public.counters
  set
    start_number = case jenis when 'SJ' then p_start_sj else p_start_bast end,
    next_number = case jenis when 'SJ' then p_start_sj else p_start_bast end,
    locked = true,
    updated_at = now()
  where jenis in ('SJ', 'BAST');

  update public.settings
  set token_hash = v_token_hash,
      setup_completed_at = now(),
      session_version = 1,
      updated_at = now()
  where id = 1;

  insert into public.audit_log (aksi, tabel, record_key, nilai_baru, detail)
  values (
    'setup_awal_selesai',
    'settings',
    '1',
    jsonb_build_object('setup_completed_at', now()),
    jsonb_build_object(
      'start_sj', p_start_sj,
      'start_bast', p_start_bast,
      'hash_algorithm', 'bcrypt',
      'bcrypt_cost', 12,
      'prehash', 'SHA-256'
    )
  );

  return jsonb_build_object(
    'setup_completed', true,
    'start_sj', p_start_sj,
    'start_bast', p_start_bast,
    'session_version', 1
  );
end;
$$;

create or replace function public.change_access_token(
  p_current_token text,
  p_new_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_settings public.settings%rowtype;
  v_old_pre_hash text;
  v_new_pre_hash text;
  v_new_hash text;
  v_next_version bigint;
begin
  if p_current_token is null
     or char_length(btrim(p_current_token)) < 6
     or char_length(btrim(p_current_token)) > 128 then
    raise exception using errcode = '28000',
      message = 'PIN lama tidak sesuai.';
  end if;

  if p_new_token is null
     or char_length(btrim(p_new_token)) < 6
     or char_length(btrim(p_new_token)) > 128 then
    raise exception using errcode = '22023',
      message = 'PIN baru harus berisi 6 sampai 128 karakter.';
  end if;

  select * into v_settings
  from public.settings
  where id = 1
  for update;

  if not found
     or v_settings.setup_completed_at is null
     or v_settings.token_hash is null then
    raise exception using errcode = '55000',
      message = 'Setup Awal belum selesai.';
  end if;

  v_old_pre_hash := encode(
    extensions.digest(convert_to(btrim(p_current_token), 'UTF8'), 'sha256'),
    'hex'
  );

  if extensions.crypt(v_old_pre_hash, v_settings.token_hash)
     <> v_settings.token_hash then
    raise exception using errcode = '28000',
      message = 'PIN lama tidak sesuai.';
  end if;

  v_new_pre_hash := encode(
    extensions.digest(convert_to(btrim(p_new_token), 'UTF8'), 'sha256'),
    'hex'
  );

  if v_new_pre_hash = v_old_pre_hash then
    raise exception using errcode = '22023',
      message = 'PIN baru harus berbeda dari PIN lama.';
  end if;

  v_new_hash := extensions.crypt(
    v_new_pre_hash,
    extensions.gen_salt('bf', 12)
  );
  v_next_version := v_settings.session_version + 1;

  update public.settings
  set token_hash = v_new_hash,
      session_version = v_next_version,
      updated_at = now()
  where id = 1;

  insert into public.audit_log (
    aksi, tabel, record_key, actor, nilai_lama, nilai_baru, detail
  )
  values (
    'token_diubah',
    'settings',
    '1',
    'token',
    jsonb_build_object(
      'token_hash_sha256',
      left(encode(extensions.digest(v_settings.token_hash, 'sha256'), 'hex'), 16)
    ),
    jsonb_build_object(
      'token_hash_sha256',
      left(encode(extensions.digest(v_new_hash, 'sha256'), 'hex'), 16)
    ),
    jsonb_build_object(
      'session_version_lama', v_settings.session_version,
      'session_version_baru', v_next_version,
      'hash_algorithm', 'bcrypt',
      'bcrypt_cost', 12,
      'prehash', 'SHA-256'
    )
  );

  return jsonb_build_object(
    'success', true,
    'session_version', v_next_version
  );
end;
$$;

create or replace function public.authenticate_access_token(p_token text)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_settings public.settings%rowtype;
  v_token_pre_hash text;
begin
  if p_token is null
     or char_length(btrim(p_token)) < 6
     or char_length(btrim(p_token)) > 128 then
    return null;
  end if;

  v_token_pre_hash := encode(
    extensions.digest(convert_to(btrim(p_token), 'UTF8'), 'sha256'),
    'hex'
  );

  select * into v_settings
  from public.settings
  where id = 1
  for share;

  if not found
     or v_settings.setup_completed_at is null
     or v_settings.token_hash is null then
    return null;
  end if;

  if extensions.crypt(v_token_pre_hash, v_settings.token_hash)
     <> v_settings.token_hash then
    return null;
  end if;

  return v_settings.session_version;
end;
$$;

revoke all on function public.verify_access_token(text)
  from public, anon, authenticated;
revoke all on function public.selesaikan_setup_awal_dengan_pin(text, bigint, bigint)
  from public, anon, authenticated;
revoke all on function public.change_access_token(text, text)
  from public, anon, authenticated;
revoke all on function public.authenticate_access_token(text)
  from public, anon, authenticated;

grant execute on function public.verify_access_token(text) to service_role;
grant execute on function public.selesaikan_setup_awal_dengan_pin(text, bigint, bigint) to service_role;
grant execute on function public.change_access_token(text, text) to service_role;
grant execute on function public.authenticate_access_token(text) to service_role;

comment on function public.verify_access_token(text) is
  'Verifies 6..128 character AutoDoc PIN using SHA-256 prehash plus bcrypt cost 12; server service_role only.';
comment on function public.selesaikan_setup_awal_dengan_pin(text, bigint, bigint) is
  'Completes first-time setup; hashes 6..128 char PIN with SHA-256 prehash + bcrypt cost 12 and locks initial counters.';
comment on function public.change_access_token(text, text) is
  'Requires current PIN, rotates SHA-256-prehashed bcrypt token and increments session_version.';
comment on function public.authenticate_access_token(text) is
  'Verifies SHA-256-prehashed bcrypt PIN and returns matching session_version under a shared settings-row lock.';
