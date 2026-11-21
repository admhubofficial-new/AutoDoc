# AutoDoc

Website otomatisasi dokumen-dokumen penunjang pekerjaan di Satuan Pelayanan Pemenuhan Gizi Gratis Darmaraja 01.

## Modul Surat Jalan & BAST MBG

### Tahap 1 — Database

- 13 tabel aplikasi dengan Row Level Security aktif.
- Tidak ada policy untuk role `anon` maupun `authenticated`.
- Akses data aplikasi hanya melalui backend tepercaya menggunakan kunci Supabase server-side.
- Nomor SJ dan BAST memakai counter terpisah, dengan fungsi PostgreSQL atomik.
- Bucket `assets` untuk logo dan `bast-ttd` privat untuk scan BAST.
- Data awal: 17 penerima, 443 porsi kecil, 1.751 porsi besar, total 2.194.

### Tahap 2 — Setup dan autentikasi PIN

- Frontend statis dipublikasikan melalui GitHub Pages.
- Backend autentikasi dijalankan melalui Supabase Edge Function `autodoc-auth`; folder `api/` bukan backend untuk GitHub Pages.
- Secret awal dibaca di server dari Supabase Edge Function Secrets dengan nama `PIN MASUK` (juga mendukung nama `PIN_MASUK`).
- Saat Setup Awal, pengguna memasukkan PIN yang sudah disimpan di Supabase. Edge Function mencocokkannya di server, kemudian mengirim PIN itu langsung ke RPC database untuk disimpan sebagai hash; PIN asli tidak disimpan ke tabel atau dikembalikan ke browser.
- PIN/token minimal 6 dan maksimal 128 karakter; database memakai SHA-256 pre-hash lalu bcrypt cost 12 melalui pgcrypto.
- Setelah setup awal, login membandingkan PIN terhadap hash di database. Perubahan PIN berikutnya menggunakan mekanisme rotasi token database dan tidak mengubah secret bootstrap.
- Cookie sesi HMAC-SHA256, HttpOnly, Secure, SameSite=None dan Partitioned untuk panggilan lintas situs GitHub Pages ↔ Supabase, berlaku 12 jam.
- Lima kegagalan PIN berturut-turut mengunci akses bersama selama 15 menit.
- Validasi sesi memeriksa `session_version` di database; perubahan PIN membatalkan sesi lama semua perangkat.
- Endpoint verifikasi ulang PIN tersedia untuk alur sensitif. Setiap endpoint mutasi sensitif tetap wajib memverifikasi PIN di dalam permintaan mutasinya sendiri.
- Kunci backend Supabase hanya dibaca Edge Function; yang ada di frontend hanya publishable key yang memang boleh dipublikasikan.
- CORS hanya mengizinkan origin `https://admhubofficial-new.github.io`.

### Konfigurasi Supabase

Pastikan secret yang sudah dibuat tetap tersimpan di:

**Supabase → Edge Functions → Secrets**

Nama yang saat ini dikenali oleh kode: `PIN MASUK`. Kode juga mendukung `PIN_MASUK` jika key tersebut diubah ke format underscore. Jangan menyalin nilai PIN ke GitHub, source code, atau chat.

Edge Function memakai variabel default proyek Supabase:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` legacy, atau `SUPABASE_SECRET_KEYS` jika proyek memakai secret API key baru.

### Deployment

- Push ke `main` memicu GitHub Pages untuk memperbarui frontend statis.
- Edge Function `autodoc-auth` perlu dideploy ke proyek Supabase dengan JWT gateway verification dimatikan; fungsi melakukan validasi origin, PIN, session, dan pembatasan percobaan sendiri.
- Publishable key di `index.html` adalah public key dan memang untuk frontend. Jangan pernah menaruh `service_role` atau `sb_secret` di sana.

### Pengujian

- `npm test` — unit test sesi dan PIN.
- `deno check supabase/functions/autodoc-auth/index.ts` — pemeriksaan tipe Edge Function.

### Catatan data sumber

- Kabupaten Sumedang disalin dari sheet Pengaturan dan ditandai perlu diverifikasi.
- Kader Cempaka 1–6 masing-masing 2 orang dipertahankan sesuai catatan asumsi workbook dan ditandai perlu verifikasi.
- Alamat penerima, alamat SPPG, nama kepala SPPG, pengemudi, kendaraan, petugas dan menu yang kosong tetap kosong untuk dilengkapi melalui Data Master.
- File logo belum tersedia dalam workbook. Bucket `assets` sudah disiapkan; unggah `logo-bgn.png` saat tersedia.
