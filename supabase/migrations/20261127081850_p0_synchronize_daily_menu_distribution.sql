-- P0: serialize planning and distribution preparation on the existing per-date lock.
create function public.autodoc_save_daily_plans(p_plans jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  r jsonb; day date; items text[]; existing public.daily_menu_plans%rowtype;
  dist_id uuid; actual text[]; saved jsonb; output jsonb := '[]'::jsonb;
begin
  if p_plans is null or jsonb_typeof(p_plans) <> 'array' or jsonb_array_length(p_plans) not between 1 and 20 then
    raise exception using errcode='22023', message='Simpan 1 sampai 20 tanggal.';
  end if;
  for r in select value from jsonb_array_elements(p_plans) order by value->>'tanggal' loop
    day := (r->>'tanggal')::date;
    if day is null or day < (now() at time zone 'Asia/Jakarta')::date then
      raise exception using errcode='22023', message='Tanggal rencana harus hari ini atau mendatang.';
    end if;
    if jsonb_typeof(r->'menu_items') is distinct from 'array' then raise exception using errcode='22023', message='Menu tidak valid.'; end if;
    select array_agg(btrim(value #>> '{}') order by ordinality) into items from jsonb_array_elements(r->'menu_items') with ordinality;
    if coalesce(cardinality(items),0) not between 1 and 8 or exists(select 1 from jsonb_array_elements(r->'menu_items') x(value) where jsonb_typeof(value) is distinct from 'string' or char_length(btrim(value #>> '{}')) not between 1 and 180) then
      raise exception using errcode='22023', message='Menu harus memiliki 1–8 komponen valid.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('autodoc:distribution:'||day::text,0));
    select id into dist_id from public.distributions where tanggal=day;
    if found then
      select coalesce(array_agg(nama_komponen order by urutan),array[]::text[]) into actual from public.distribution_menu_items where distribution_id=dist_id;
      if actual is distinct from items then
        raise exception using errcode='55000', message='Menu tanggal '||day::text||' telah dikunci oleh distribusi. Gunakan data distribusi atau Arsip.';
      end if;
    end if;
    select * into existing from public.daily_menu_plans where tanggal=day for update;
    if found and existing.menu_items=items then
      saved := to_jsonb(existing);
    else
      if r ? 'expected_updated_at' and (r->>'expected_updated_at')::timestamptz is distinct from existing.updated_at then
        raise exception using errcode='40001', message='Rencana menu tanggal '||day::text||' sudah berubah. Muat ulang sebelum menyimpan.';
      end if;
      insert into public.daily_menu_plans(tanggal,menu_items,updated_at) values(day,items,clock_timestamp())
        on conflict(tanggal) do update set menu_items=excluded.menu_items,updated_at=excluded.updated_at
        returning to_jsonb(daily_menu_plans.*) into saved;
    end if;
    output:=output||jsonb_build_array(saved);
  end loop;
  return output;
end $$;

create function public.autodoc_prepare_distribution(
  p_tanggal date,p_menu_items jsonb,p_waktu_makan text,p_nama_petugas text,
  p_nama_pengemudi text,p_no_kendaraan text,p_jam_berangkat time
) returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  items text[]; planned text[]; dist_id uuid; locked boolean:=false; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('autodoc:distribution:'||p_tanggal::text,0));
  select coalesce(array_agg(btrim(value) order by ordinality),array[]::text[]) into items from jsonb_array_elements_text(p_menu_items) with ordinality;
  select id into dist_id from public.distributions where tanggal=p_tanggal;
  if found then
    select exists(select 1 from public.documents where distribution_id=dist_id) into locked;
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
end $$;
revoke all on function public.autodoc_save_daily_plans(jsonb) from public,anon,authenticated;
grant execute on function public.autodoc_save_daily_plans(jsonb) to service_role;
revoke all on function public.autodoc_prepare_distribution(date,jsonb,text,text,text,text,time) from public,anon,authenticated;
grant execute on function public.autodoc_prepare_distribution(date,jsonb,text,text,text,text,time) to service_role;

