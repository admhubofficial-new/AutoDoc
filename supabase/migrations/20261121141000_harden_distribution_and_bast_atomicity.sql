-- Harden distribution snapshots and make BAST realization atomic.
-- Additive only: existing operational records are preserved.

create or replace function public.prevent_distribution_change_after_documents()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if exists (
    select 1
    from public.documents d
    where d.distribution_id = old.id
  ) and (
    new.tanggal is distinct from old.tanggal
    or new.menu is distinct from old.menu
    or new.nama_petugas is distinct from old.nama_petugas
    or new.nama_pengemudi is distinct from old.nama_pengemudi
    or new.no_kendaraan is distinct from old.no_kendaraan
    or new.jam_berangkat is distinct from old.jam_berangkat
  ) then
    raise exception using
      errcode = '55000',
      message = 'Data distribusi tidak dapat diubah setelah dokumen diterbitkan. Snapshot dokumen harus tetap konsisten.';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_distribution_change_after_documents() from public, anon, authenticated;

drop trigger if exists trg_distributions_immutable_after_documents on public.distributions;
create trigger trg_distributions_immutable_after_documents
before update of tanggal, menu, nama_petugas, nama_pengemudi, no_kendaraan, jam_berangkat
on public.distributions
for each row execute function public.prevent_distribution_change_after_documents();

create or replace function public.simpan_realisasi_bast(
  p_document_id uuid,
  p_realisasi jsonb,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_document public.documents%rowtype;
  v_item_count integer;
  v_type_count integer;
begin
  if p_document_id is null
     or p_realisasi is null
     or jsonb_typeof(p_realisasi) is distinct from 'object'
     or p_items is null
     or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Payload realisasi BAST tidak valid.';
  end if;

  if jsonb_array_length(p_items) <> 2 then
    raise exception using errcode = '22023', message = 'Realisasi BAST harus memuat dua jenis porsi.';
  end if;

  select * into v_document
  from public.documents
  where id = p_document_id
  for update;

  if not found or v_document.jenis <> 'BAST' then
    raise exception using errcode = '22023', message = 'Dokumen BAST tidak ditemukan.';
  end if;

  if v_document.status = 'batal' then
    raise exception using errcode = '55000', message = 'Dokumen BAST yang dibatalkan tidak dapat direalisasikan.';
  end if;

  select count(*), count(distinct x.jenis_porsi)
  into v_item_count, v_type_count
  from jsonb_to_recordset(p_items) as x(
    urutan integer,
    kelompok_sasaran text,
    jenis_porsi text,
    jumlah_diserahkan integer,
    jumlah_diterima integer,
    keterangan text
  );

  if v_item_count <> 2 or v_type_count <> 2 then
    raise exception using errcode = '22023', message = 'Rincian realisasi BAST tidak lengkap atau duplikat.';
  end if;

  insert into public.bast_realisasi (
    document_id, kondisi, jam_diterima, suhu_c, ompreng_kembali,
    catatan, nama_penerima, jabatan_penerima
  )
  values (
    p_document_id,
    nullif(p_realisasi->>'kondisi', ''),
    nullif(p_realisasi->>'jam_diterima', '')::time,
    nullif(p_realisasi->>'suhu_c', '')::numeric,
    nullif(p_realisasi->>'ompreng_kembali', '')::integer,
    nullif(p_realisasi->>'catatan', ''),
    nullif(p_realisasi->>'nama_penerima', ''),
    nullif(p_realisasi->>'jabatan_penerima', '')
  )
  on conflict (document_id) do update set
    kondisi = excluded.kondisi,
    jam_diterima = excluded.jam_diterima,
    suhu_c = excluded.suhu_c,
    ompreng_kembali = excluded.ompreng_kembali,
    catatan = excluded.catatan,
    nama_penerima = excluded.nama_penerima,
    jabatan_penerima = excluded.jabatan_penerima;

  insert into public.bast_realisasi_items (
    document_id, urutan, kelompok_sasaran, jenis_porsi,
    jumlah_diserahkan, jumlah_diterima, keterangan
  )
  select
    p_document_id, x.urutan, x.kelompok_sasaran, x.jenis_porsi,
    x.jumlah_diserahkan, x.jumlah_diterima, x.keterangan
  from jsonb_to_recordset(p_items) as x(
    urutan integer,
    kelompok_sasaran text,
    jenis_porsi text,
    jumlah_diserahkan integer,
    jumlah_diterima integer,
    keterangan text
  )
  on conflict (document_id, urutan) do update set
    kelompok_sasaran = excluded.kelompok_sasaran,
    jenis_porsi = excluded.jenis_porsi,
    jumlah_diserahkan = excluded.jumlah_diserahkan,
    jumlah_diterima = excluded.jumlah_diterima,
    keterangan = excluded.keterangan;

  update public.documents
  set status = 'selesai'
  where id = p_document_id;
end;
$$;

revoke all on function public.simpan_realisasi_bast(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.simpan_realisasi_bast(uuid, jsonb, jsonb) to service_role;

comment on function public.simpan_realisasi_bast(uuid, jsonb, jsonb) is
  'Menyimpan header dan rincian realisasi BAST serta status dokumen dalam satu transaksi.';
