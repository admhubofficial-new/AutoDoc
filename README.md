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
- Backend autentikasi dijalankan melalui Supabase Edge Function `autodoc-auth`.
- Secret awal dibaca di server dari Supabase Edge Function Secrets dengan nama `PIN MASUK` (juga mendukung nama `PIN_MASUK`).
- Saat Setup Awal, pengguna memasukkan PIN yang sudah disimpan di Supabase. Edge Function mencocokkannya di server, kemudian mengirim PIN itu langsung ke RPC database untuk disimpan sebagai hash; PIN asli tidak disimpan ke tabel atau dikembalikan ke browser.
- PIN/token minimal 6 dan maksimal 128 karakter; database memakai SHA-256 pre-hash lalu bcrypt cost 12 melalui pgcrypto.
- Setelah setup awal, login membandingkan PIN terhadap hash di database. Perubahan PIN berikutnya menggunakan mekanisme rotasi token database dan tidak mengubah secret bootstrap.
- Cookie sesi HMAC-SHA256, HttpOnly, Secure, SameSite=None dan Partitioned untuk panggilan lintas situs GitHub Pages ↔ Supabase, berlaku 12 jam.
- Lima kegagalan PIN berturut-turut mengunci akses bersama selama 15 menit.
- Validasi sesi memeriksa `session_version` di database; perubahan PIN membatalkan sesi lama semua perangkat.
- Endpoint verifikasi ulang PIN tersedia untuk tindakan yang memerlukannya. Penerbitan SJ/BAST memerlukan sesi login aktif tanpa PIN ulang; realisasi BAST tetap memerlukan konfirmasi PIN di dalam permintaan mutasinya.
- Kunci backend Supabase hanya dibaca Edge Function; yang ada di frontend hanya publishable key yang memang boleh dipublikasikan.
- CORS hanya mengizinkan origin `https://admhubofficial-new.github.io`.



### Tahap 3 — Dashboard operasional\n\n- Ringkasan jumlah distribusi, dokumen SJ/BAST, status dokumen, dan BAST yang menunggu realisasi.\n- Pemantauan kelengkapan Data Master dan daftar lima distribusi terbaru.\n- Ringkasan dibaca melalui Edge Function dengan sesi aktif; tidak ada akses langsung browser ke tabel Supabase.\n\n### Tahap 3A — Penyempurnaan alur UI/UX operasional

- Navigasi utama menggunakan Beranda, Buat Dokumen, Arsip, dan Data Master.
- Pembuatan SJ/BAST memakai tiga langkah: informasi distribusi, pemilihan penerima secara eksplisit, dan pemeriksaan sebelum penerbitan.
- Arsip menampilkan daftar distribusi terbaru yang dapat dicari berdasarkan tanggal, menu, petugas, pengemudi, atau kendaraan; dokumen dikelompokkan per penerima.
- Arsip mendukung cetak massal Surat Jalan atau BAST per tanggal, serta cetak dokumen per penerima.
- Data Master dapat dibuka langsung ke jenis data tertentu dan menyediakan pencarian pada daftar aktif.
- Dialog dokumen dan Data Master menjaga fokus keyboard serta dapat ditutup dengan Escape.
- Penyempurnaan tampilan tidak mengubah kontrak penerbitan, nomor dokumen, snapshot, autentikasi, PIN, atau penguncian percobaan.

### Tahap 4 — Surat Jalan & BAST MBG

- Penerbitan pasangan Surat Jalan dan BAST per penerima pada tanggal distribusi.
- Nomor SJ dan BAST menggunakan counter database terpisah dan fungsi PostgreSQL atomik yang sudah tersedia.
- Data distribusi, identitas SPPG, penerima, menu, petugas, pengemudi, kendaraan, dan rincian porsi disimpan sebagai snapshot immutable pada saat penerbitan.
- Penerbitan SJ/BAST hanya memerlukan sesi login aktif (tanpa PIN ulang). Penyimpanan realisasi BAST tetap memerlukan verifikasi PIN ulang.
- Dokumen dapat ditampilkan dan dicetak dengan layout A4 melalui dialog cetak browser (termasuk Save as PDF).
- Realisasi BAST mencatat kondisi makanan, jam diterima, suhu, jumlah porsi diserahkan/diterima, ompreng, identitas penerima, dan catatan.
- Penyimpanan realisasi BAST dan perubahan status dokumen berjalan atomik dalam satu transaksi database.
- Data distribusi dikunci dari perubahan setelah dokumen pertama diterbitkan agar riwayat dan snapshot dokumen tetap konsisten.
- Jika proses penerbitan sebagian gagal, pengulangan untuk tanggal dan penerima yang sama menggunakan kembali nomor dokumen yang sudah berhasil dibuat dan melengkapi sisanya.
- Status `dicetak` dicatat setelah dialog cetak browser dipanggil dan ditutup; browser tidak menyediakan sinyal andal untuk membedakan hasil cetak fisik dari pembatalan dialog.
- Impor Data Master mendukung file CSV ber-delimiter koma, titik koma, atau tab, termasuk nilai berpetik dan status aktif yang kosong (default aktif).
- Cetak mengubah status dokumen dari dibuat menjadi dicetak; penyimpanan realisasi BAST mengubah status menjadi selesai.

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
- Publishable key di `config.js` adalah public key dan memang untuk frontend. Jangan pernah menaruh `service_role` atau `sb_secret` di sana.

### Pengujian

- `npm test` — unit test helper sesi/PIN, tanggal, waktu, UUID, bilangan bulat, content-range count, parser CSV, dan kontrak alur endpoint dokumen/dashboard.
- Pengujian integrasi produksi yang menulis data tidak dijalankan otomatis agar tidak mengonsumsi nomor dokumen atau mengubah data operasional. Dashboard hanya menjalankan permintaan HEAD/GET dan tidak menulis database.\n- Pengulangan tanggal distribusi dengan dokumen yang sudah terbit harus menggunakan detail perjalanan yang sama; backend mengubah percobaan pengubahan snapshot menjadi konflik HTTP 409 yang mudah dipahami.
- `deno check supabase/functions/autodoc-auth/index.ts` — pemeriksaan tipe Edge Function.

### Catatan data sumber

- Kabupaten Sumedang disalin dari sheet Pengaturan dan ditandai perlu diverifikasi.
- Kader Cempaka 1–6 masing-masing 2 orang dipertahankan sesuai catatan asumsi workbook dan ditandai perlu verifikasi.
- Alamat penerima, alamat SPPG, nama kepala SPPG, pengemudi, kendaraan, petugas dan menu yang kosong tetap kosong untuk dilengkapi melalui Data Master.
- File logo belum tersedia dalam workbook. Bucket `assets` sudah disiapkan; unggah `logo-bgn.png` saat tersedia.
