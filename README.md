# AutoDoc

Website otomatisasi dokumen-dokumen penunjang pekerjaan di Satuan Pelayanan Pemenuhan Gizi Gratis Darmaraja 01.

## Modul Surat Jalan & BAST MBG

Tahap 1 menambahkan skema PostgreSQL dan seed data penerima manfaat dari workbook sumber.

- 13 tabel aplikasi dengan Row Level Security aktif.
- Tidak ada policy untuk role `anon` atau `authenticated`; akses data aplikasi hanya untuk backend tepercaya menggunakan `service_role`.
- Nomor SJ dan BAST menggunakan counter terpisah dan fungsi PostgreSQL transaksional.
- Snapshot dokumen, audit log, realisasi BAST, serta dua bucket Storage disediakan.
- Data awal: 17 penerima, 443 porsi kecil, 1.751 porsi besar, total 2.194.

### Catatan data sumber

- Kabupaten Sumedang disalin dari sheet Pengaturan dan ditandai perlu diverifikasi.
- Kader Cempaka 1–6 masing-masing 2 orang dipertahankan sesuai catatan asumsi di workbook dan ditandai perlu verifikasi.
- Alamat penerima, alamat SPPG, nama kepala SPPG, pengemudi, kendaraan, petugas dan menu yang kosong di workbook tetap kosong untuk dilengkapi pada Data Master.
- Workbook tidak menyertakan berkas gambar logo. Bucket `assets` telah disiapkan; unggah file `logo-bgn.png` saat tersedia.

### Environment

Salin `.env.example` ke `.env.local` untuk pengembangan lokal, kemudian isi variabelnya. Jangan commit `.env.local` atau nilai rahasia apa pun.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — hanya di server/Vercel, tidak pernah di browser.
- `SESSION_SECRET` — secret acak untuk cookie sesi.
- `APP_ORIGIN`

### Status

- Frontend welcome/login masih berupa prototipe statis.
- Login token dan pengaturan nomor awal belum diaktifkan sampai Tahap 2.
- Tidak ada dokumen operasional yang dibuat pada Tahap 1.
