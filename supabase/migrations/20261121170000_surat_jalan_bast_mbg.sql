-- AutoDoc Stage 1: Surat Jalan & BAST MBG
-- PostgreSQL 17 / Supabase
-- Source: Surat_Jalan_dan_BAST_MBG_Darmaraja.xlsx
-- This migration is repeat-safe for the currently provisioned AutoDoc database.
-- Do not place credentials, plaintext PINs, or environment values in this file.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  nama_sppg text not null,
  kode_sppg text not null,
  alamat text,
  kecamatan text not null,
  kabupaten text not null,
  kabupaten_perlu_verifikasi boolean not null default false,
  kabupaten_catatan_verifikasi text,
  nama_kepala_sppg text,
  logo_path text,
  token_hash text,
  setup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.counters (
  jenis text primary key check (jenis in ('SJ', 'BAST')),
  start_number bigint not null check (start_number >= 1),
  next_number bigint not null check (next_number >= 1),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counters_next_not_before_start check (next_number >= start_number)
);

create table if not exists public.recipients (
  id uuid primary key default gen_random_uuid(),
  kelompok text not null check (kelompok in ('Sekolah/Lembaga', 'Posyandu')),
  nama text not null,
  jenjang text not null,
  aktif boolean not null default true,
  urutan integer not null check (urutan >= 1),
  alamat text,
  siswa_kecil integer not null default 0 check (siswa_kecil >= 0),
  siswa_besar integer not null default 0 check (siswa_besar >= 0),
  tendik integer not null default 0 check (tendik >= 0),
  ibu_hamil integer not null default 0 check (ibu_hamil >= 0),
  ibu_menyusui integer not null default 0 check (ibu_menyusui >= 0),
  balita integer not null default 0 check (balita >= 0),
  putus_sekolah integer not null default 0 check (putus_sekolah >= 0),
  kader integer not null default 0 check (kader >= 0),
  porsi_kecil integer generated always as (siswa_kecil + balita) stored,
  porsi_besar integer generated always as (siswa_besar + tendik + ibu_hamil + ibu_menyusui + putus_sekolah + kader) stored,
  total_porsi integer generated always as (siswa_kecil + balita + siswa_besar + tendik + ibu_hamil + ibu_menyusui + putus_sekolah + kader) stored,
  keterangan text,
  perlu_verifikasi boolean not null default false,
  catatan_verifikasi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipients_group_name_unique unique (kelompok, nama)
);

create table if not exists public.master_pengemudi (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  aktif boolean not null default true,
  urutan integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_kendaraan (
  id uuid primary key default gen_random_uuid(),
  no_kendaraan text not null unique,
  aktif boolean not null default true,
  urutan integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_petugas (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  jabatan text,
  aktif boolean not null default true,
  urutan integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.master_menu (
  id uuid primary key default gen_random_uuid(),
  teks_menu text not null unique,
  aktif boolean not null default true,
  urutan integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distributions (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null unique,
  menu text,
  nama_petugas text,
  nama_pengemudi text,
  no_kendaraan text,
  jam_berangkat time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.distributions(id) on update restrict on delete restrict,
  recipient_id uuid not null references public.recipients(id) on update restrict on delete restrict,
  jenis text not null check (jenis in ('SJ', 'BAST')),
  nomor_urut bigint not null check (nomor_urut >= 1),
  nomor_lengkap text not null unique,
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  status text not null default 'dibuat' check (status in ('dibuat', 'dicetak', 'ditandatangani', 'selesai', 'batal')),
  alasan_batal text,
  file_ttd_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_daily_recipient_kind_unique unique (distribution_id, recipient_id, jenis),
  constraint documents_cancel_reason_required check (status <> 'batal' or nullif(btrim(alasan_batal), '') is not null)
);

create table if not exists public.bast_realisasi (
  document_id uuid primary key references public.documents(id) on update restrict on delete restrict,
  kondisi text check (kondisi in ('baik', 'kurang baik', 'tidak layak')),
  jam_diterima time,
  suhu_c numeric(5,2) check (suhu_c is null or suhu_c between -50 and 100),
  ompreng_kembali integer check (ompreng_kembali is null or ompreng_kembali >= 0),
  catatan text,
  nama_penerima text,
  jabatan_penerima text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bast_realisasi_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.bast_realisasi(document_id) on update restrict on delete restrict,
  urutan integer not null check (urutan >= 1),
  kelompok_sasaran text not null,
  jenis_porsi text not null check (jenis_porsi in ('Porsi Kecil', 'Porsi Besar')),
  jumlah_diserahkan integer not null check (jumlah_diserahkan >= 0),
  jumlah_diterima integer not null check (jumlah_diterima >= 0),
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bast_realisasi_item_order_unique unique (document_id, urutan)
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  waktu timestamptz not null default now(),
  aksi text not null,
  tabel text not null,
  record_key text,
  actor text,
  nilai_lama jsonb,
  nilai_baru jsonb,
  detail jsonb not null default '{}'::jsonb
);

create table if not exists public.login_attempts (
  key_hash text primary key,
  failed_attempts smallint not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists recipients_active_order_idx on public.recipients (aktif, urutan);
create index if not exists recipients_group_active_order_idx on public.recipients (kelompok, aktif, urutan);
create index if not exists documents_distribution_idx on public.documents (distribution_id, jenis);
create index if not exists documents_recipient_idx on public.documents (recipient_id, created_at desc);
create index if not exists documents_status_created_idx on public.documents (status, created_at desc);
create index if not exists documents_number_kind_idx on public.documents (jenis, nomor_urut);
create index if not exists bast_realisasi_items_document_idx on public.bast_realisasi_items (document_id, urutan);
create index if not exists audit_log_waktu_idx on public.audit_log (waktu desc);
create index if not exists audit_log_tabel_record_idx on public.audit_log (tabel, record_key, waktu desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.documents'::regclass
      and conname = 'documents_kind_sequence_unique'
  ) then
    alter table public.documents
      add constraint documents_kind_sequence_unique unique (jenis, nomor_urut);
  end if;
end;
$$;

comment on table public.settings is 'Pengaturan tunggal identitas SPPG dan hash token akses AutoDoc.';
comment on column public.settings.kabupaten_perlu_verifikasi is 'Penanda asumsi dari workbook yang harus diverifikasi di Data Master.';
comment on table public.counters is 'Nomor SJ dan BAST terpisah. next_number tidak direset berdasarkan bulan/tahun.';
comment on table public.recipients is 'Data master 17 titik penerima manfaat dari workbook sumber.';
comment on column public.recipients.porsi_kecil is 'Generated: siswa_kecil + balita.';
comment on column public.recipients.porsi_besar is 'Generated: siswa_besar + tendik + ibu_hamil + ibu_menyusui + putus_sekolah + kader.';
comment on column public.recipients.perlu_verifikasi is 'Penanda data asumsi yang harus diverifikasi melalui Data Master.';
comment on table public.distributions is 'Satu catatan distribusi per tanggal; unik per tanggal agar cetak ulang memakai distribusi yang sama.';
comment on table public.documents is 'Surat Jalan dan BAST dengan nomor dan snapshot yang tidak berubah.';
comment on column public.documents.snapshot_json is 'Snapshot identitas SPPG, penerima, rincian porsi, dan data distribusi saat dokumen dibuat.';
comment on table public.bast_realisasi is 'Realisasi umum penerimaan BAST.';
comment on table public.bast_realisasi_items is 'Realisasi jumlah diterima untuk setiap baris rincian BAST.';
comment on table public.audit_log is 'Log append-only untuk perubahan penting, termasuk nilai lama dan baru.';
comment on table public.login_attempts is 'Counter percobaan token berbasis key_hash dari server; tidak menyimpan IP atau token polos.';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_key text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old) - array['token_hash'];
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new) - array['token_hash'];
  end if;

  v_key := coalesce(
    v_new ->> 'id',
    v_old ->> 'id',
    v_new ->> 'jenis',
    v_old ->> 'jenis',
    v_new ->> 'document_id',
    v_old ->> 'document_id',
    v_new ->> 'key_hash',
    v_old ->> 'key_hash'
  );

  insert into public.audit_log (
    aksi, tabel, record_key, actor, nilai_lama, nilai_baru, detail
  )
  values (
    tg_op,
    tg_table_name,
    v_key,
    nullif(current_setting('app.audit_actor', true), ''),
    v_old,
    v_new,
    jsonb_build_object('sumber', 'trigger_database')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.protect_document_record()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '42501',
      message = 'Dokumen tidak dapat dihapus. Gunakan status batal dengan alasan.';
  end if;

  if old.nomor_urut is distinct from new.nomor_urut
     or old.nomor_lengkap is distinct from new.nomor_lengkap
     or old.jenis is distinct from new.jenis
     or old.distribution_id is distinct from new.distribution_id
     or old.recipient_id is distinct from new.recipient_id
     or old.snapshot_json is distinct from new.snapshot_json
     or old.created_at is distinct from new.created_at then
    raise exception using
      errcode = '42501',
      message = 'Nomor, identitas, tanggal/snapshot dokumen tidak boleh diubah setelah dibuat.';
  end if;

  if old.status = 'batal' and new.status <> 'batal' then
    raise exception using
      errcode = '42501',
      message = 'Dokumen batal tidak dapat diaktifkan kembali.';
  end if;

  if old.status = 'batal' and new.alasan_batal is distinct from old.alasan_batal then
    raise exception using
      errcode = '42501',
      message = 'Alasan pembatalan dokumen tidak dapat diubah.';
  end if;

  if new.status = 'batal' and old.status <> 'batal'
     and nullif(btrim(new.alasan_batal), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Alasan pembatalan wajib diisi.';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_bast_document_type()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.documents
    where id = new.document_id and jenis = 'BAST'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Realisasi hanya dapat dicatat untuk dokumen BAST.';
  end if;
  return new;
end;
$$;

create or replace function public.romawi_bulan(p_tanggal date)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case extract(month from p_tanggal)::integer
    when 1 then 'I'
    when 2 then 'II'
    when 3 then 'III'
    when 4 then 'IV'
    when 5 then 'V'
    when 6 then 'VI'
    when 7 then 'VII'
    when 8 then 'VIII'
    when 9 then 'IX'
    when 10 then 'X'
    when 11 then 'XI'
    when 12 then 'XII'
  end;
$$;

create or replace function public.selesaikan_setup_awal(
  p_token_hash text,
  p_start_sj bigint,
  p_start_bast bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_settings public.settings%rowtype;
  v_unlocked_count integer;
begin
  if p_start_sj is null or p_start_sj < 1 or p_start_bast is null or p_start_bast < 1 then
    raise exception using errcode = '22023', message = 'Nomor awal SJ dan BAST minimal 1.';
  end if;

  if p_token_hash is null or not (
    p_token_hash like '$argon2id$%'
    or p_token_hash like '$2a$%'
    or p_token_hash like '$2b$%'
    or p_token_hash like '$2y$%'
  ) then
    raise exception using errcode = '22023', message = 'Token harus dikirim dalam bentuk hash Argon2id atau bcrypt.';
  end if;

  select * into v_settings
  from public.settings
  where id = 1
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Pengaturan SPPG belum tersedia.';
  end if;

  if v_settings.setup_completed_at is not null or v_settings.token_hash is not null then
    raise exception using errcode = '55000', message = 'Setup awal sudah pernah diselesaikan.';
  end if;

  if exists (select 1 from public.documents) then
    raise exception using errcode = '55000', message = 'Setup awal tidak dapat dilakukan karena dokumen sudah pernah dibuat.';
  end if;

  perform 1
  from public.counters
  order by jenis
  for update;

  select count(*) into v_unlocked_count
  from public.counters
  where jenis in ('SJ', 'BAST') and locked = false;

  if v_unlocked_count <> 2 then
    raise exception using errcode = '55000', message = 'Counter SJ dan BAST tidak berada dalam status setup awal.';
  end if;

  update public.counters
  set
    start_number = case jenis when 'SJ' then p_start_sj else p_start_bast end,
    next_number = case jenis when 'SJ' then p_start_sj else p_start_bast end,
    locked = true,
    updated_at = now()
  where jenis in ('SJ', 'BAST');

  update public.settings
  set token_hash = p_token_hash,
      setup_completed_at = now(),
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
      'hash_algorithm', case when p_token_hash like '$argon2id$%' then 'argon2id' else 'bcrypt' end
    )
  );

  return jsonb_build_object(
    'setup_completed', true,
    'start_sj', p_start_sj,
    'start_bast', p_start_bast
  );
end;
$$;

create or replace function public.ubah_nomor_awal(
  p_jenis text,
  p_nomor_awal_baru bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_counter public.counters%rowtype;
  v_max_used bigint;
begin
  if p_jenis not in ('SJ', 'BAST') then
    raise exception using errcode = '22023', message = 'Jenis dokumen harus SJ atau BAST.';
  end if;

  if p_nomor_awal_baru is null or p_nomor_awal_baru < 1 then
    raise exception using errcode = '22023', message = 'Nomor awal minimal 1.';
  end if;

  select * into v_counter
  from public.counters
  where jenis = p_jenis
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Counter dokumen tidak ditemukan.';
  end if;

  select coalesce(max(nomor_urut), 0) into v_max_used
  from public.documents
  where jenis = p_jenis;

  if p_nomor_awal_baru <= v_max_used then
    raise exception using
      errcode = '23505',
      message = 'Nomor awal ditolak karena dapat memakai ulang nomor yang sudah pernah digunakan.';
  end if;

  update public.counters
  set
    start_number = p_nomor_awal_baru,
    next_number = p_nomor_awal_baru,
    locked = true,
    updated_at = now()
  where jenis = p_jenis;

  return jsonb_build_object(
    'jenis', p_jenis,
    'start_number', p_nomor_awal_baru,
    'next_number', p_nomor_awal_baru,
    'locked', true
  );
end;
$$;

create or replace function public.buat_dokumen_dengan_nomor(
  p_distribution_id uuid,
  p_recipient_id uuid,
  p_jenis text,
  p_snapshot_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_tanggal date;
  v_kode_sppg text;
  v_counter public.counters%rowtype;
  v_existing public.documents%rowtype;
  v_new public.documents%rowtype;
  v_nomor_teks text;
  v_nomor_lengkap text;
begin
  if p_jenis not in ('SJ', 'BAST') then
    raise exception using errcode = '22023', message = 'Jenis dokumen harus SJ atau BAST.';
  end if;

  if p_snapshot_json is null or jsonb_typeof(p_snapshot_json) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Snapshot dokumen harus berupa objek JSON.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_distribution_id::text || ':' || p_recipient_id::text || ':' || p_jenis, 0)
  );

  select tanggal into v_tanggal
  from public.distributions
  where id = p_distribution_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Data distribusi tidak ditemukan.';
  end if;

  perform 1
  from public.recipients
  where id = p_recipient_id and aktif = true;

  if not found then
    raise exception using errcode = 'P0002', message = 'Penerima tidak ditemukan atau sudah nonaktif.';
  end if;

  select * into v_existing
  from public.documents
  where distribution_id = p_distribution_id
    and recipient_id = p_recipient_id
    and jenis = p_jenis;

  if found then
    return jsonb_build_object(
      'document_id', v_existing.id,
      'nomor_urut', v_existing.nomor_urut,
      'nomor_lengkap', v_existing.nomor_lengkap,
      'status', v_existing.status,
      'reused', true
    );
  end if;

  if not exists (
    select 1 from public.settings
    where id = 1 and token_hash is not null and setup_completed_at is not null
  ) then
    raise exception using errcode = '55000', message = 'Setup Awal belum selesai.';
  end if;

  select * into v_counter
  from public.counters
  where jenis = p_jenis
  for update;

  if not found or v_counter.locked = false then
    raise exception using errcode = '55000', message = 'Nomor awal dokumen belum dikunci melalui Setup Awal.';
  end if;

  select kode_sppg into v_kode_sppg
  from public.settings
  where id = 1;

  v_nomor_teks := case
    when length(v_counter.next_number::text) < 3 then lpad(v_counter.next_number::text, 3, '0')
    else v_counter.next_number::text
  end;

  v_nomor_lengkap := v_nomor_teks
    || '/' || p_jenis
    || '/' || v_kode_sppg
    || '/' || public.romawi_bulan(v_tanggal)
    || '/' || extract(year from v_tanggal)::integer::text;

  update public.counters
  set next_number = next_number + 1,
      updated_at = now()
  where jenis = p_jenis;

  insert into public.documents (
    distribution_id,
    recipient_id,
    jenis,
    nomor_urut,
    nomor_lengkap,
    snapshot_json
  )
  values (
    p_distribution_id,
    p_recipient_id,
    p_jenis,
    v_counter.next_number,
    v_nomor_lengkap,
    p_snapshot_json
  )
  returning * into v_new;

  return jsonb_build_object(
    'document_id', v_new.id,
    'nomor_urut', v_new.nomor_urut,
    'nomor_lengkap', v_new.nomor_lengkap,
    'status', v_new.status,
    'reused', false
  );
end;
$$;

-- Replace known triggers safely; do not disturb Supabase-managed schemas.
drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at before update on public.settings
for each row execute function public.touch_updated_at();
drop trigger if exists trg_counters_updated_at on public.counters;
create trigger trg_counters_updated_at before update on public.counters
for each row execute function public.touch_updated_at();
drop trigger if exists trg_recipients_updated_at on public.recipients;
create trigger trg_recipients_updated_at before update on public.recipients
for each row execute function public.touch_updated_at();
drop trigger if exists trg_master_pengemudi_updated_at on public.master_pengemudi;
create trigger trg_master_pengemudi_updated_at before update on public.master_pengemudi
for each row execute function public.touch_updated_at();
drop trigger if exists trg_master_kendaraan_updated_at on public.master_kendaraan;
create trigger trg_master_kendaraan_updated_at before update on public.master_kendaraan
for each row execute function public.touch_updated_at();
drop trigger if exists trg_master_petugas_updated_at on public.master_petugas;
create trigger trg_master_petugas_updated_at before update on public.master_petugas
for each row execute function public.touch_updated_at();
drop trigger if exists trg_master_menu_updated_at on public.master_menu;
create trigger trg_master_menu_updated_at before update on public.master_menu
for each row execute function public.touch_updated_at();
drop trigger if exists trg_distributions_updated_at on public.distributions;
create trigger trg_distributions_updated_at before update on public.distributions
for each row execute function public.touch_updated_at();
drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at before update on public.documents
for each row execute function public.touch_updated_at();
drop trigger if exists trg_bast_realisasi_updated_at on public.bast_realisasi;
create trigger trg_bast_realisasi_updated_at before update on public.bast_realisasi
for each row execute function public.touch_updated_at();
drop trigger if exists trg_bast_realisasi_items_updated_at on public.bast_realisasi_items;
create trigger trg_bast_realisasi_items_updated_at before update on public.bast_realisasi_items
for each row execute function public.touch_updated_at();
drop trigger if exists trg_login_attempts_updated_at on public.login_attempts;
create trigger trg_login_attempts_updated_at before update on public.login_attempts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_documents_protect on public.documents;
create trigger trg_documents_protect before update or delete on public.documents
for each row execute function public.protect_document_record();

drop trigger if exists trg_settings_audit on public.settings;
create trigger trg_settings_audit after insert or update or delete on public.settings
for each row execute function public.audit_row_change();
drop trigger if exists trg_counters_audit on public.counters;
create trigger trg_counters_audit after insert or update or delete on public.counters
for each row execute function public.audit_row_change();
drop trigger if exists trg_recipients_audit on public.recipients;
create trigger trg_recipients_audit after insert or update or delete on public.recipients
for each row execute function public.audit_row_change();
drop trigger if exists trg_master_pengemudi_audit on public.master_pengemudi;
create trigger trg_master_pengemudi_audit after insert or update or delete on public.master_pengemudi
for each row execute function public.audit_row_change();
drop trigger if exists trg_master_kendaraan_audit on public.master_kendaraan;
create trigger trg_master_kendaraan_audit after insert or update or delete on public.master_kendaraan
for each row execute function public.audit_row_change();
drop trigger if exists trg_master_petugas_audit on public.master_petugas;
create trigger trg_master_petugas_audit after insert or update or delete on public.master_petugas
for each row execute function public.audit_row_change();
drop trigger if exists trg_master_menu_audit on public.master_menu;
create trigger trg_master_menu_audit after insert or update or delete on public.master_menu
for each row execute function public.audit_row_change();
drop trigger if exists trg_distributions_audit on public.distributions;
create trigger trg_distributions_audit after insert or update or delete on public.distributions
for each row execute function public.audit_row_change();
drop trigger if exists trg_documents_audit on public.documents;
create trigger trg_documents_audit after insert or update or delete on public.documents
for each row execute function public.audit_row_change();
drop trigger if exists trg_bast_realisasi_audit on public.bast_realisasi;
create trigger trg_bast_realisasi_audit after insert or update or delete on public.bast_realisasi
for each row execute function public.audit_row_change();
drop trigger if exists trg_bast_realisasi_items_audit on public.bast_realisasi_items;
create trigger trg_bast_realisasi_items_audit after insert or update or delete on public.bast_realisasi_items
for each row execute function public.audit_row_change();
drop trigger if exists trg_login_attempts_audit on public.login_attempts;
create trigger trg_login_attempts_audit after insert or update or delete on public.login_attempts
for each row execute function public.audit_row_change();

drop trigger if exists trg_bast_realisasi_type on public.bast_realisasi;
create trigger trg_bast_realisasi_type before insert or update on public.bast_realisasi
for each row execute function public.ensure_bast_document_type();
drop trigger if exists trg_bast_realisasi_items_type on public.bast_realisasi_items;
create trigger trg_bast_realisasi_items_type before insert or update on public.bast_realisasi_items
for each row execute function public.ensure_bast_document_type();

-- Seed configuration from the workbook. Blank cells remain NULL.
insert into public.settings (
  id, nama_sppg, kode_sppg, alamat, kecamatan, kabupaten,
  kabupaten_perlu_verifikasi, kabupaten_catatan_verifikasi,
  nama_kepala_sppg, logo_path, token_hash
)
values (
  1,
  'SPPG Darmaraja',
  'SPPG-DARMARAJA',
  null,
  'Darmaraja',
  'Sumedang',
  true,
  'Asumsi: Darmaraja = Kab. Sumedang, mohon cek',
  null,
  'logo-bgn.png',
  null
)
on conflict (id) do nothing;

insert into public.counters (jenis, start_number, next_number, locked)
values
  ('SJ', 1, 1, false),
  ('BAST', 1, 1, false)
on conflict (jenis) do nothing;

insert into public.recipients (
  kelompok, nama, jenjang, aktif, urutan,
  siswa_kecil, siswa_besar, tendik, ibu_hamil, ibu_menyusui,
  balita, putus_sekolah, kader, keterangan, perlu_verifikasi, catatan_verifikasi
)
values
  ('Sekolah/Lembaga', 'KOBER HIDAYATULFALAH', 'PAUD/TK', true, 1, 13, 0, 3, 0, 0, 0, 0, 0, null, false, null),
  ('Sekolah/Lembaga', 'RA AL MAARIJ', 'RA', true, 2, 20, 0, 4, 0, 0, 0, 0, 0, null, false, null),
  ('Sekolah/Lembaga', 'SDN DARMARAJA III', 'SD', true, 3, 64, 57, 10, 0, 0, 0, 0, 0, null, false, null),
  ('Sekolah/Lembaga', 'MTs DARMARAJA', 'MTs (SMP)', true, 4, 0, 79, 13, 0, 0, 0, 0, 0, null, false, null),
  ('Sekolah/Lembaga', 'SMAN DARMARAJA', 'SMA', true, 5, 0, 1356, 74, 0, 0, 0, 0, 0, 'Kelas X: 492; Kelas XI dan XII: 414 + 450 (catatan di file sumber)', false, null),
  ('Posyandu', 'KENANGA 1', 'Posyandu', true, 6, 0, 0, 0, 2, 4, 26, 1, 2, null, false, null),
  ('Posyandu', 'KENANGA 2', 'Posyandu', true, 7, 0, 0, 0, 5, 3, 17, 0, 2, null, false, null),
  ('Posyandu', 'KENANGA 3', 'Posyandu', true, 8, 0, 0, 0, 3, 3, 20, 0, 2, null, false, null),
  ('Posyandu', 'KENANGA 4', 'Posyandu', true, 9, 0, 0, 0, 3, 0, 28, 1, 2, null, false, null),
  ('Posyandu', 'KENANGA 5', 'Posyandu', true, 10, 0, 0, 0, 5, 11, 36, 3, 2, null, false, null),
  ('Posyandu', 'KENANGA 6', 'Posyandu', true, 11, 0, 0, 0, 3, 6, 41, 4, 2, null, false, null),
  ('Posyandu', 'CEMPAKA 1', 'Posyandu', true, 12, 0, 0, 0, 1, 1, 23, 2, 2, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)', true, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)'),
  ('Posyandu', 'CEMPAKA 2', 'Posyandu', true, 13, 0, 0, 0, 4, 6, 23, 2, 2, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)', true, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)'),
  ('Posyandu', 'CEMPAKA 3', 'Posyandu', true, 14, 0, 0, 0, 4, 6, 24, 0, 2, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)', true, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)'),
  ('Posyandu', 'CEMPAKA 4', 'Posyandu', true, 15, 0, 0, 0, 2, 9, 29, 0, 2, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)', true, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)'),
  ('Posyandu', 'CEMPAKA 5', 'Posyandu', true, 16, 0, 0, 0, 6, 6, 44, 0, 2, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)', true, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)'),
  ('Posyandu', 'CEMPAKA 6', 'Posyandu', true, 17, 0, 0, 0, 5, 20, 35, 0, 2, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)', true, 'Kader = 2 orang (asumsi, kolom kader Cempaka tidak ada di file; total kader 24 di rekap)')
on conflict (kelompok, nama) do nothing;

insert into public.audit_log (aksi, tabel, record_key, nilai_baru, detail)
select
  'seed_data_pm',
  'recipients',
  '17',
  jsonb_build_object(
    'jumlah_penerima', 17,
    'sekolah_lembaga', 5,
    'posyandu', 12,
    'porsi_kecil', 443,
    'porsi_besar', 1751,
    'total_porsi', 2194
  ),
  jsonb_build_object(
    'sumber', 'Surat_Jalan_dan_BAST_MBG_Darmaraja.xlsx',
    'sheet', 'Data PM',
    'asumsi', jsonb_build_array(
      'Kader Cempaka 1-6 masing-masing 2 orang',
      'Kabupaten Sumedang'
    )
  )
where not exists (
  select 1 from public.audit_log
  where aksi = 'seed_data_pm'
    and tabel = 'recipients'
    and record_key = '17'
);

-- Enable RLS for every AutoDoc table in the exposed public schema.
alter table public.settings enable row level security;
alter table public.counters enable row level security;
alter table public.recipients enable row level security;
alter table public.master_pengemudi enable row level security;
alter table public.master_kendaraan enable row level security;
alter table public.master_petugas enable row level security;
alter table public.master_menu enable row level security;
alter table public.distributions enable row level security;
alter table public.documents enable row level security;
alter table public.bast_realisasi enable row level security;
alter table public.bast_realisasi_items enable row level security;
alter table public.audit_log enable row level security;
alter table public.login_attempts enable row level security;

-- No anon/authenticated policies are intentionally created.
revoke all privileges on table
  public.settings,
  public.counters,
  public.recipients,
  public.master_pengemudi,
  public.master_kendaraan,
  public.master_petugas,
  public.master_menu,
  public.distributions,
  public.documents,
  public.bast_realisasi,
  public.bast_realisasi_items,
  public.audit_log,
  public.login_attempts
from public, anon, authenticated;

grant usage on schema public to service_role;

revoke all privileges on table public.settings from service_role;
grant select, update on table public.settings to service_role;

grant select on table public.counters to service_role;
grant select, update on table public.documents to service_role;
grant select, insert on table public.audit_log to service_role;

grant select, insert, update on table
  public.recipients,
  public.master_pengemudi,
  public.master_kendaraan,
  public.master_petugas,
  public.master_menu,
  public.distributions,
  public.bast_realisasi,
  public.bast_realisasi_items
to service_role;

grant select, insert, update, delete on table public.login_attempts to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.protect_document_record() from public, anon, authenticated;
revoke all on function public.ensure_bast_document_type() from public, anon, authenticated;
revoke all on function public.romawi_bulan(date) from public, anon, authenticated;
revoke all on function public.selesaikan_setup_awal(text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.ubah_nomor_awal(text, bigint) from public, anon, authenticated;
revoke all on function public.buat_dokumen_dengan_nomor(uuid, uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.romawi_bulan(date) to service_role;
grant execute on function public.selesaikan_setup_awal(text, bigint, bigint) to service_role;
grant execute on function public.ubah_nomor_awal(text, bigint) to service_role;
grant execute on function public.buat_dokumen_dengan_nomor(uuid, uuid, text, jsonb) to service_role;

-- The logo bucket is public-read only; writes still require trusted server credentials.
-- Signed BAST scans are stored in a separate private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('assets', 'assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('bast-ttd', 'bast-ttd', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();
