-- The non-unique index duplicates the valid unique index for (jenis, nomor_urut).
do $$
begin
 if not exists(select 1 from pg_catalog.pg_index a join pg_catalog.pg_index b on a.indrelid=b.indrelid
   where a.indexrelid='public.documents_number_kind_idx'::regclass and b.indexrelid='public.documents_kind_sequence_unique'::regclass
   and b.indisunique and b.indisvalid and b.indisready and a.indkey=b.indkey and a.indclass=b.indclass and a.indcollation=b.indcollation and a.indoption=b.indoption
   and a.indpred is null and b.indpred is null and a.indexprs is null and b.indexprs is null
   and not exists(select 1 from pg_catalog.pg_constraint where conindid=a.indexrelid))
 then raise exception 'Duplicate index safety check failed';end if;
end $$;
drop index public.documents_number_kind_idx restrict;
