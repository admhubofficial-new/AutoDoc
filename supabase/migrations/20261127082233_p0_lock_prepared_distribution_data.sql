CREATE OR REPLACE FUNCTION public.autodoc_prepare_distribution(p_tanggal date, p_menu_items jsonb, p_waktu_makan text, p_nama_petugas text, p_nama_pengemudi text, p_no_kendaraan text, p_jam_berangkat time without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  items text[]; planned text[]; dist public.distributions%rowtype; actual text[]; locked boolean:=false; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('autodoc:distribution:'||p_tanggal::text,0));
  select coalesce(array_agg(btrim(value) order by ordinality),array[]::text[]) into items from jsonb_array_elements_text(p_menu_items) with ordinality;
  select * into dist from public.distributions where tanggal=p_tanggal;
  if found then
    select coalesce(array_agg(nama_komponen order by urutan),array[]::text[]) into actual from public.distribution_menu_items where distribution_id=dist.id;
    if actual is distinct from items or dist.nama_petugas is distinct from nullif(btrim(p_nama_petugas),'')
       or dist.nama_pengemudi is distinct from nullif(btrim(p_nama_pengemudi),'')
       or dist.no_kendaraan is distinct from nullif(btrim(p_no_kendaraan),'')
       or dist.jam_berangkat is distinct from p_jam_berangkat
       or dist.waktu_makan is distinct from p_waktu_makan then
      raise exception using errcode='55000', message='Data distribusi tanggal ini telah dikunci. Muat ulang data distribusi sebelum terbit.';
    end if;
    locked:=true;
  end if;
  select menu_items into planned from public.daily_menu_plans where tanggal=p_tanggal for update;
  if found and not locked and planned is distinct from items then
    raise exception using errcode='55000', message='Rencana menu telah berubah. Muat ulang atau simpan perubahan menu sebelum menerbitkan.';
  end if;
  result:=public.simpan_distribusi_dan_menu(p_tanggal,p_menu_items,p_waktu_makan,p_nama_petugas,p_nama_pengemudi,p_no_kendaraan,p_jam_berangkat);
  if cardinality(items)>0 then
    insert into public.daily_menu_plans(tanggal,menu_items,updated_at) values(p_tanggal,items,clock_timestamp())
      on conflict(tanggal) do update set menu_items=excluded.menu_items,updated_at=excluded.updated_at
      where daily_menu_plans.menu_items is distinct from excluded.menu_items;
  end if;
  return result;
end $function$;

