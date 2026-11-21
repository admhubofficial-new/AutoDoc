-- Preserve legacy optionality for trip detail fields when preparing a distribution.
-- The original wizard explicitly allows Petugas, Pengemudi, and Kendaraan to be blank.

CREATE OR REPLACE FUNCTION public.simpan_distribusi_dan_menu(
  p_tanggal date,
  p_menu_items jsonb,
  p_waktu_makan text,
  p_nama_petugas text,
  p_nama_pengemudi text,
  p_no_kendaraan text,
  p_jam_berangkat time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_distribution public.distributions%rowtype;
  v_settings_ahli_gizi text;
  v_nama_petugas text;
  v_nama_pengemudi text;
  v_no_kendaraan text;
  v_menu text;
  v_requested_items jsonb;
  v_existing_items jsonb;
  v_locked boolean;
BEGIN
  v_nama_petugas := nullif(btrim(p_nama_petugas), '');
  v_nama_pengemudi := nullif(btrim(p_nama_pengemudi), '');
  v_no_kendaraan := nullif(btrim(p_no_kendaraan), '');

  IF p_tanggal IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tanggal distribusi wajib diisi.';
  END IF;
  IF p_menu_items IS NULL OR jsonb_typeof(p_menu_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Daftar komponen menu harus berupa array.';
  END IF;
  IF jsonb_array_length(p_menu_items) > 8 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Menu Hari Ini maksimal 8 komponen.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_menu_items) AS x(value)
    WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string'
      OR char_length(btrim(x.value #>> '{}')) NOT BETWEEN 1 AND 180
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Setiap komponen menu wajib berisi 1 sampai 180 karakter.';
  END IF;
  IF p_waktu_makan IS NULL OR p_waktu_makan NOT IN ('pagi', 'siang', 'sore') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Waktu makan harus pagi, siang, atau sore.';
  END IF;
  IF char_length(coalesce(v_nama_petugas, '')) > 180
    OR char_length(coalesce(v_nama_pengemudi, '')) > 180
    OR char_length(coalesce(v_no_kendaraan, '')) > 80 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data petugas, pengemudi, atau kendaraan terlalu panjang.';
  END IF;

  SELECT nullif(btrim(s.nama_ahli_gizi), '') INTO v_settings_ahli_gizi
  FROM public.settings s WHERE s.id = 1;

  SELECT coalesce(
    jsonb_agg(jsonb_build_object('urutan', x.ordinality, 'nama_komponen', btrim(x.value #>> '{}')) ORDER BY x.ordinality),
    '[]'::jsonb
  ) INTO v_requested_items
  FROM jsonb_array_elements(p_menu_items) WITH ORDINALITY AS x(value, ordinality);

  SELECT nullif(string_agg(btrim(x.value #>> '{}'), ', ' ORDER BY x.ordinality), '')
  INTO v_menu
  FROM jsonb_array_elements(p_menu_items) WITH ORDINALITY AS x(value, ordinality);

  PERFORM pg_advisory_xact_lock(hashtextextended('autodoc:distribution:' || p_tanggal::text, 0));

  SELECT * INTO v_distribution
  FROM public.distributions d
  WHERE d.tanggal = p_tanggal
  FOR UPDATE;

  IF FOUND THEN
    SELECT EXISTS (
      SELECT 1 FROM public.documents d WHERE d.distribution_id = v_distribution.id
    ) INTO v_locked;

    IF v_locked THEN
      SELECT coalesce(
        jsonb_agg(jsonb_build_object('urutan', i.urutan, 'nama_komponen', i.nama_komponen) ORDER BY i.urutan),
        '[]'::jsonb
      ) INTO v_existing_items
      FROM public.distribution_menu_items i
      WHERE i.distribution_id = v_distribution.id;

      IF v_distribution.menu IS DISTINCT FROM v_menu
        OR v_distribution.nama_petugas IS DISTINCT FROM v_nama_petugas
        OR v_distribution.nama_pengemudi IS DISTINCT FROM v_nama_pengemudi
        OR v_distribution.no_kendaraan IS DISTINCT FROM v_no_kendaraan
        OR v_distribution.jam_berangkat IS DISTINCT FROM p_jam_berangkat
        OR v_distribution.waktu_makan IS DISTINCT FROM p_waktu_makan
        OR v_existing_items IS DISTINCT FROM v_requested_items THEN
        RAISE EXCEPTION USING
          ERRCODE = '55000',
          MESSAGE = 'Tanggal ini sudah memiliki dokumen. Data distribusi dan komponen menu harus sama persis dengan data yang telah diterbitkan.';
      END IF;

      RETURN jsonb_build_object(
        'id', v_distribution.id, 'tanggal', v_distribution.tanggal,
        'menu', v_distribution.menu, 'menu_items', v_existing_items,
        'nama_petugas', v_distribution.nama_petugas, 'nama_pengemudi', v_distribution.nama_pengemudi,
        'no_kendaraan', v_distribution.no_kendaraan, 'jam_berangkat', v_distribution.jam_berangkat,
        'waktu_makan', v_distribution.waktu_makan, 'nama_ahli_gizi', v_distribution.nama_ahli_gizi,
        'reused', true
      );
    END IF;

    UPDATE public.distributions
    SET menu = v_menu,
        nama_petugas = v_nama_petugas,
        nama_pengemudi = v_nama_pengemudi,
        no_kendaraan = v_no_kendaraan,
        jam_berangkat = p_jam_berangkat,
        waktu_makan = p_waktu_makan,
        nama_ahli_gizi = coalesce(v_distribution.nama_ahli_gizi, v_settings_ahli_gizi)
    WHERE id = v_distribution.id
    RETURNING * INTO v_distribution;

    DELETE FROM public.distribution_menu_items WHERE distribution_id = v_distribution.id;
  ELSE
    INSERT INTO public.distributions (
      tanggal, menu, nama_petugas, nama_pengemudi, no_kendaraan,
      jam_berangkat, waktu_makan, nama_ahli_gizi
    )
    VALUES (
      p_tanggal, v_menu, v_nama_petugas, v_nama_pengemudi, v_no_kendaraan,
      p_jam_berangkat, p_waktu_makan, v_settings_ahli_gizi
    )
    RETURNING * INTO v_distribution;
  END IF;

  INSERT INTO public.distribution_menu_items (distribution_id, urutan, nama_komponen)
  SELECT v_distribution.id, x.ordinality::smallint, btrim(x.value)
  FROM jsonb_array_elements_text(p_menu_items) WITH ORDINALITY AS x(value, ordinality);

  RETURN jsonb_build_object(
    'id', v_distribution.id, 'tanggal', v_distribution.tanggal,
    'menu', v_distribution.menu, 'menu_items', v_requested_items,
    'nama_petugas', v_distribution.nama_petugas, 'nama_pengemudi', v_distribution.nama_pengemudi,
    'no_kendaraan', v_distribution.no_kendaraan, 'jam_berangkat', v_distribution.jam_berangkat,
    'waktu_makan', v_distribution.waktu_makan, 'nama_ahli_gizi', v_distribution.nama_ahli_gizi,
    'reused', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_distribusi_dan_menu(date, jsonb, text, text, text, text, time)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simpan_distribusi_dan_menu(date, jsonb, text, text, text, text, time)
  TO service_role;
