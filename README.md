# AutoDoc

Website otomatisasi dokumen-dokumen penunjang pekerjaan di Satuan Pelayanan Pemenuhan Gizi Gratis Darmaraja 01.

## Modul Surat Jalan & BAST MBG

### Tahap 1 — Database

- 13 tabel aplikasi dengan Row Level Security aktif.
- Tidak ada policy untuk role `anon` maupun `authenticated`.
- Akses data aplikasi hanya melalui backend tepercaya menggunakan `SUPABASE_SERVICE_ROLE_KEY`.
- Nomor SJ dan BAST memakai counter terpisah, dengan fungsi PostgreSQL atomik.
- Bucket `assets` untuk logo dan `bast-ttd` privat untuk scan BAST.
- Data awal: 17 penerima, 443 porsi kecil, 1.751 porsi besar, total 2.194.

### Tahap 2 — Setup dan autentikasi token

- Setup awal hanya dapat diselesaikan satu kali.
- PIN/token minimal 6 dan maksimal 128 karakter; PIN dipre-hash SHA-256 lalu di-hash bcrypt cost 12 di PostgreSQL melalui pgcrypto (aman untuk PIN hingga 128 karakter).
- Cookie sesi ditandatangani HMAC-SHA256, HttpOnly, SameSite=Strict, dan berlaku 12 jam.
- Lima kegagalan token mengunci akses bersama selama 15 menit.
- Mengganti token mewajibkan PIN lama dan menaikkan `session_version`, sehingga sesi lama seluruh perangkat tidak berlaku.
- `/api/auth/verify-token` memverifikasi ulang token untuk alur sensitif. Endpoint mutasi sensitif tetap harus meminta PIN pada permintaan mutasinya sendiri.
- Seluruh akses database dilakukan server-side memakai REST API Supabase dengan `SUPABASE_SERVICE_ROLE_KEY`. Kunci ini tidak pernah dikirim ke browser.
- API memakai Web Fetch API bawaan Node.js/Vercel; tidak ada dependensi runtime pihak ketiga.

### Menjalankan lokal

1. Gunakan Node.js 22 (lihat `.nvmrc`).
2. Salin `.env.example` menjadi `.env.local`.
3. Isi variabel berikut:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET` (buat dengan `openssl rand -base64 48`)
   - `APP_ORIGIN` (contoh `http://localhost:3000`)
4. Jalankan proyek melalui Vercel lokal atau deploy ke Vercel. API menggunakan Vercel Node.js Functions di direktori `api/`.

### Pengujian

- `npm test`

### Catatan data sumber

- Kabupaten Sumedang disalin dari sheet Pengaturan dan ditandai perlu diverifikasi.
- Kader Cempaka 1–6 masing-masing 2 orang dipertahankan sesuai catatan asumsi workbook dan ditandai perlu verifikasi.
- Alamat penerima, alamat SPPG, nama kepala SPPG, pengemudi, kendaraan, petugas dan menu yang kosong tetap kosong untuk dilengkapi melalui Data Master.
- File logo belum tersedia dalam workbook. Bucket `assets` sudah disiapkan; unggah `logo-bgn.png` saat tersedia.
