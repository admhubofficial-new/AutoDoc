-- Stage 1: daily menu components, meal time, and frozen identity fields.
-- Additive only: existing documents, snapshots, and counters are not modified.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS nama_kepala_sppi text,
  ADD COLUMN IF NOT EXISTS nama_ahli_gizi text;

COMMENT ON COLUMN public.settings.nama_kepala_sppi IS
  'Nama Kepala SPPI yang ditampilkan pada tanda tangan BAST.';
COMMENT ON COLUMN public.settings.nama_ahli_gizi IS
  'Nama ahli gizi dapur untuk disalin ke distribusi saat dokumen pertama kali diterbitkan.';

ALTER TABLE public.distributions
  ADD COLUMN IF NOT EXISTS waktu_makan text NOT NULL DEFAULT 'siang',
  ADD COLUMN IF NOT EXISTS nama_ahli_gizi text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'distributions_waktu_makan_check'
      AND conrelid = 'public.distributions'::regclass
  ) THEN
    ALTER TABLE public.distributions
      ADD CONSTRAINT distributions_waktu_makan_check
      CHECK (waktu_makan IN ('pagi', 'siang', 'sore'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.distributions.waktu_makan IS
  'Waktu makan saat distribusi: pagi, siang, atau sore.';
COMMENT ON COLUMN public.distributions.nama_ahli_gizi IS
  'Snapshot nama ahli gizi dapur pada saat distribusi/dokumen pertama kali disiapkan.';

CREATE TABLE IF NOT EXISTS public.distribution_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  urutan smallint NOT NULL CHECK (urutan BETWEEN 1 AND 8),
  nama_komponen text NOT NULL CHECK (char_length(btrim(nama_komponen)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT distribution_menu_items_distribution_urutan_key UNIQUE (distribution_id, urutan)
);

COMMENT ON TABLE public.distribution_menu_items IS
  'Komponen menu harian untuk formulir uji organoleptik. Maksimal delapan item per distribusi.';

-- Preserve legacy text exactly as one component; do not guess its internal split.
-- This backfill runs before immutability triggers are attached.
INSERT INTO public.distribution_menu_items (distribution_id, urutan, nama_komponen)
SELECT d.id, 1, btrim(d.menu)
FROM public.distributions d
WHERE nullif(btrim(d.menu), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.distribution_menu_items i WHERE i.distribution_id = d.id
  );

ALTER TABLE public.distribution_menu_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.distribution_menu_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.distribution_menu_items TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_distribution_change_after_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.documents d WHERE d.distribution_id = OLD.id
  ) AND (
    NEW.tanggal IS DISTINCT FROM OLD.tanggal
    OR NEW.menu IS DISTINCT FROM OLD.menu
    OR NEW.nama_petugas IS DISTINCT FROM OLD.nama_petugas
    OR NEW.nama_pengemudi IS DISTINCT FROM OLD.nama_pengemudi
    OR NEW.no_kendaraan IS DISTINCT FROM OLD.no_kendaraan
    OR NEW.jam_berangkat IS DISTINCT FROM OLD.jam_berangkat
    OR NEW.waktu_makan IS DISTINCT FROM OLD.waktu_makan
    OR NEW.nama_ahli_gizi IS DISTINCT FROM OLD.nama_ahli_gizi
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Data distribusi, waktu makan, dan identitas ahli gizi terkunci setelah dokumen diterbitkan.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_distribution_change_after_documents()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_distributions_immutable_after_documents ON public.distributions;
CREATE TRIGGER trg_distributions_immutable_after_documents
BEFORE UPDATE OF tanggal, menu, nama_petugas, nama_pengemudi, no_kendaraan,
  jam_berangkat, waktu_makan, nama_ahli_gizi
ON public.distributions
FOR EACH ROW EXECUTE FUNCTION public.prevent_distribution_change_after_documents();

CREATE OR REPLACE FUNCTION public.prevent_distribution_menu_item_change_after_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_distribution_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_distribution_id := OLD.distribution_id;
  ELSE
    v_distribution_id := NEW.distribution_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.documents d WHERE d.distribution_id = v_distribution_id
  ) OR (
    TG_OP = 'UPDATE'
    AND EXISTS (
      SELECT 1 FROM public.documents d WHERE d.distribution_id = OLD.distribution_id
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Komponen menu tidak dapat diubah setelah dokumen distribusi diterbitkan.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_distribution_menu_item_change_after_documents()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_distribution_menu_items_immutable_after_documents
BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_menu_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_distribution_menu_item_change_after_documents();

CREATE TRIGGER trg_distribution_menu_items_audit
AFTER INSERT OR UPDATE OR DELETE ON public.distribution_menu_items
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER trg_distribution_menu_items_updated_at
BEFORE UPDATE ON public.distribution_menu_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

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
  v_menu text;
  v_requested_items jsonb;
  v_existing_items jsonb;
  v_locked boolean;
BEGIN
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
  IF nullif(btrim(p_nama_petugas), '') IS NULL OR char_length(p_nama_petugas) > 180
    OR nullif(btrim(p_nama_pengemudi), '') IS NULL OR char_length(p_nama_pengemudi) > 180
    OR nullif(btrim(p_no_kendaraan), '') IS NULL OR char_length(p_no_kendaraan) > 80 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Petugas, pengemudi, dan nomor kendaraan wajib diisi dengan benar.';
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

  -- Serialize attempts to prepare the same distribution date.
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
        OR v_distribution.nama_petugas IS DISTINCT FROM p_nama_petugas
        OR v_distribution.nama_pengemudi IS DISTINCT FROM p_nama_pengemudi
        OR v_distribution.no_kendaraan IS DISTINCT FROM p_no_kendaraan
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
        nama_petugas = p_nama_petugas,
        nama_pengemudi = p_nama_pengemudi,
        no_kendaraan = p_no_kendaraan,
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
      p_tanggal, v_menu, p_nama_petugas, p_nama_pengemudi, p_no_kendaraan,
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

COMMENT ON FUNCTION public.simpan_distribusi_dan_menu(date, jsonb, text, text, text, text, time) IS
  'Simpan distribusi dan maksimal delapan komponen menu dalam satu transaksi serta bekukan identitas ahli gizi saat dokumen terbit.';
