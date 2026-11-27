-- P1: individual master records; defaults are selected on active records.
alter table public.master_pengemudi add column default_pengiriman boolean not null default false;
alter table public.master_kendaraan add column default_pengiriman boolean not null default false, add column jenis_kendaraan text;
-- Preserve the two existing individual vehicle IDs and their model information.
update public.master_kendaraan set no_kendaraan='Z 8734 HS',jenis_kendaraan='GrandMax' where no_kendaraan='GrandMax Z 8734 HS';
update public.master_kendaraan set no_kendaraan='Z 8952 AI',jenis_kendaraan='GrandMax' where no_kendaraan='GrandMax Z8952 AI';
insert into public.master_pengemudi(nama,aktif,urutan,default_pengiriman) values
 ('Budi Supriadi',true,10,true),('Elzar Rifandanu',true,20,true)
 on conflict(nama) do update set aktif=true,urutan=excluded.urutan,default_pengiriman=true;
insert into public.master_kendaraan(no_kendaraan,aktif,urutan,default_pengiriman) values
 ('Z 8734 HS',true,10,true),('Z 8952 AI',true,20,true)
 on conflict(no_kendaraan) do update set aktif=true,urutan=excluded.urutan,default_pengiriman=true;
-- Only the three verified redundant combinations are removed; documents store text snapshots, not these IDs.
delete from public.master_pengemudi where nama='Budi Supriadi / Elzar Rifandanu';
delete from public.master_kendaraan where no_kendaraan in ('GrandMax Z 8734 HS / GrandMax Z 8952 AI','Z 8734 HS / Z 8952 AI');
alter table public.master_pengemudi add constraint master_pengemudi_single_name check (nama=btrim(nama) and nama !~ '/' and char_length(nama) between 1 and 180 and nama=regexp_replace(nama,'[[:space:]]+',' ','g'));
alter table public.master_kendaraan add constraint master_kendaraan_single_plate check (no_kendaraan=upper(btrim(no_kendaraan)) and no_kendaraan !~ '/' and char_length(no_kendaraan) between 1 and 80 and no_kendaraan=regexp_replace(no_kendaraan,'[[:space:]]+',' ','g'));
create unique index master_pengemudi_normalized_unique on public.master_pengemudi(lower(nama));
create unique index master_kendaraan_normalized_unique on public.master_kendaraan(regexp_replace(no_kendaraan,'[[:space:]]','','g'));
alter table public.master_pengemudi add constraint master_pengemudi_default_active check (not default_pengiriman or aktif);
alter table public.master_kendaraan add constraint master_kendaraan_default_active check (not default_pengiriman or aktif);
create function public.autodoc_transport_defaults_guard() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
declare combined text; maximum integer;
begin
 if TG_WHEN='BEFORE' then
  perform pg_advisory_xact_lock(hashtextextended('autodoc:transport-defaults:'||TG_TABLE_NAME,0));
  return null;
 end if;
 if TG_TABLE_NAME='master_pengemudi' then
  select string_agg(nama,' / ' order by urutan,nama) into combined from public.master_pengemudi where aktif and default_pengiriman; maximum:=180;
 else
  select string_agg(no_kendaraan,' / ' order by urutan,no_kendaraan) into combined from public.master_kendaraan where aktif and default_pengiriman; maximum:=80;
 end if;
 if char_length(coalesce(combined,''))>maximum then raise exception using errcode='23514',message='Gabungan default pengiriman terlalu panjang.';end if;
 return null;
end $$;
revoke all on function public.autodoc_transport_defaults_guard() from public,anon,authenticated;
grant execute on function public.autodoc_transport_defaults_guard() to service_role;
create trigger transport_defaults_lock before insert or update or delete on public.master_pengemudi for each statement execute function public.autodoc_transport_defaults_guard();
create trigger transport_defaults_length after insert or update or delete on public.master_pengemudi for each statement execute function public.autodoc_transport_defaults_guard();
create trigger transport_defaults_lock before insert or update or delete on public.master_kendaraan for each statement execute function public.autodoc_transport_defaults_guard();
create trigger transport_defaults_length after insert or update or delete on public.master_kendaraan for each statement execute function public.autodoc_transport_defaults_guard();

