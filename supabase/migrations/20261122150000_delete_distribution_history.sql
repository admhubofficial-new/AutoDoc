-- Controlled deletion of issued distribution history.
-- Counters are intentionally untouched so deleted document numbers are never reused.

CREATE OR REPLACE FUNCTION public.protect_document_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.allow_distribution_history_delete', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Dokumen tidak dapat dihapus. Gunakan status batal dengan alasan.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.nomor_urut IS DISTINCT FROM NEW.nomor_urut
     OR OLD.nomor_lengkap IS DISTINCT FROM NEW.nomor_lengkap
     OR OLD.jenis IS DISTINCT FROM NEW.jenis
     OR OLD.distribution_id IS DISTINCT FROM NEW.distribution_id
     OR OLD.recipient_id IS DISTINCT FROM NEW.recipient_id
     OR OLD.snapshot_json IS DISTINCT FROM NEW.snapshot_json
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Nomor, identitas, tanggal/snapshot dokumen tidak boleh diubah setelah dibuat.';
  END IF;

  IF OLD.status = 'batal' AND NEW.status <> 'batal' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Dokumen batal tidak dapat diaktifkan kembali.';
  END IF;

  IF OLD.status = 'batal' AND NEW.alasan_batal IS DISTINCT FROM OLD.alasan_batal THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Alasan pembatalan dokumen tidak dapat diubah.';
  END IF;

  IF NEW.status = 'batal' AND OLD.status <> 'batal'
     AND NULLIF(BTRIM(NEW.alasan_batal), '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Alasan pembatalan wajib diisi.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.hapus_riwayat_distribusi(p_distribution_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_requested integer;
  v_found integer;
  v_documents integer;
  v_distributions integer;
BEGIN
  IF p_distribution_ids IS NULL
     OR cardinality(p_distribution_ids) < 1
     OR cardinality(p_distribution_ids) > 60
     OR array_position(p_distribution_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Pilih 1 sampai 60 riwayat distribusi yang valid.';
  END IF;

  SELECT count(DISTINCT id) INTO v_requested
  FROM unnest(p_distribution_ids) AS requested(id);
  IF v_requested <> cardinality(p_distribution_ids) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'Daftar riwayat berisi identitas duplikat.';
  END IF;

  PERFORM d.id
  FROM public.distributions AS d
  WHERE d.id = ANY(p_distribution_ids)
  ORDER BY d.id
  FOR UPDATE;

  SELECT count(*) INTO v_found
  FROM public.distributions AS d
  WHERE d.id = ANY(p_distribution_ids);
  IF v_found <> v_requested THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002',
      MESSAGE = 'Sebagian riwayat tidak ditemukan atau sudah dihapus. Muat ulang arsip.';
  END IF;

  SELECT count(*) INTO v_documents
  FROM public.documents AS d
  WHERE d.distribution_id = ANY(p_distribution_ids);

  PERFORM pg_catalog.set_config('app.allow_distribution_history_delete', 'on', true);

  DELETE FROM public.bast_realisasi_items AS ri
  USING public.bast_realisasi AS r, public.documents AS d
  WHERE ri.document_id = r.document_id
    AND d.id = r.document_id
    AND d.distribution_id = ANY(p_distribution_ids);

  DELETE FROM public.bast_realisasi AS r
  USING public.documents AS d
  WHERE r.document_id = d.id
    AND d.distribution_id = ANY(p_distribution_ids);

  DELETE FROM public.documents AS d
  WHERE d.distribution_id = ANY(p_distribution_ids);

  DELETE FROM public.distributions AS d
  WHERE d.id = ANY(p_distribution_ids);

  GET DIAGNOSTICS v_distributions = ROW_COUNT;

  INSERT INTO public.audit_log (aksi, tabel, record_key, actor, nilai_baru, detail)
  VALUES (
    'hapus_riwayat_distribusi',
    'distributions',
    array_to_string(p_distribution_ids, ','),
    'pin',
    jsonb_build_object(
      'deleted_distributions', v_distributions,
      'deleted_documents', v_documents
    ),
    jsonb_build_object(
      'distribution_ids', to_jsonb(p_distribution_ids),
      'nomor_dokumen_direset', false
    )
  );

  RETURN jsonb_build_object(
    'deleted_distributions', v_distributions,
    'deleted_documents', v_documents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hapus_riwayat_distribusi(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hapus_riwayat_distribusi(uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.protect_document_record() FROM PUBLIC, anon, authenticated;
