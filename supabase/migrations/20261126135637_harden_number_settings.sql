-- Preserve the historical high-water mark even after archive deletion.
create or replace function public.ubah_nomor_awal(p_jenis text,p_nomor_awal_baru bigint)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $function$
declare v_counter public.counters%rowtype; v_max_used bigint;
begin
 if p_jenis not in ('SJ','BAST') or p_nomor_awal_baru is null or p_nomor_awal_baru < 1 or p_nomor_awal_baru > 999999999 then
  raise exception using errcode='22023',message='Jenis atau nomor dokumen tidak valid.';
 end if;
 select * into v_counter from public.counters where jenis=p_jenis for update;
 if not found or not v_counter.locked then raise exception using errcode='55000',message='Counter belum siap.'; end if;
 select coalesce(max(nomor_urut),0) into v_max_used from public.documents where jenis=p_jenis;
 if p_nomor_awal_baru < v_counter.next_number or p_nomor_awal_baru <= v_max_used then
  raise exception using errcode='23505',message='Nomor ditolak: tidak boleh lebih rendah dari nomor berikutnya atau memakai ulang nomor lama.';
 end if;
 if p_nomor_awal_baru = v_counter.next_number then
  return jsonb_build_object('jenis',p_jenis,'start_number',v_counter.start_number,'next_number',v_counter.next_number,'locked',true);
 end if;
 update public.counters set start_number=p_nomor_awal_baru,next_number=p_nomor_awal_baru,updated_at=now() where jenis=p_jenis;
 insert into public.audit_log(aksi,tabel,record_key,actor,nilai_lama,nilai_baru,detail)
 values('ubah_nomor_awal','counters',p_jenis,'token',jsonb_build_object('start_number',v_counter.start_number,'next_number',v_counter.next_number),jsonb_build_object('start_number',p_nomor_awal_baru,'next_number',p_nomor_awal_baru),jsonb_build_object('jenis',p_jenis));
 return jsonb_build_object('jenis',p_jenis,'start_number',p_nomor_awal_baru,'next_number',p_nomor_awal_baru,'locked',true);
end;
$function$;
revoke execute on function public.ubah_nomor_awal(text,bigint) from public,anon,authenticated;
grant execute on function public.ubah_nomor_awal(text,bigint) to service_role;
