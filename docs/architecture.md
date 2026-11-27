# Arsitektur dan kontrak API

[Beranda dokumentasi](../README.md)

## Modul dan aliran data

Browser → AutoDocCore (config.js) → Edge Function autodoc-auth → Supabase REST/RPC/PostgreSQL.
AutoDocCore menyatukan API client, error HTTP dan tanggal Asia/Jakarta. Request GET identik yang masih berlangsung digabung; respons selesai tidak dicache. Mutasi dan event perubahan membatalkan reuse request sebelumnya. Preview hanya mengambil counter penomoran dan dokumen yang diperlukan; query master independen berjalan paralel. Iframe yang tidak berubah dipertahankan.

| Modul | Tanggung jawab |
|---|---|
| index.html / config.js | Shell, login, navigasi, konfigurasi publik, API client |
| documents.js | Formulir distribusi, penerima, orkestrasi cetak |
| daily-menu-planner.js / .css | Rencana tanggal, konflik revisi, riwayat, styling khusus |
| document-menu.js | Editor maksimal delapan komponen |
| document-preview.js | Preview, nomor perkiraan, zoom, navigasi |
| documents-print.js / organoleptic-print.js | Renderer cetak |
| archive.js / bast-realization.js | Pencarian arsip dan realisasi |
| master.js / master-utils.js | CRUD master dan CSV |
| dashboard.js | Ringkasan operasional |
| styles.css / theme.css | Layout dan design tokens |
| supabase/functions/autodoc-auth | Router, sesi, validasi, kontrol request dan aturan distribusi |

Tidak ada frontend asisten AI aktif yang terpisah. Endpoint AI lama tetap tersedia sampai pemakaian eksternal diketahui; jangan menganggap dukungan API tersebut sebagai fitur UI aktif.

## Skema database dan akses

Database saat ini mempunyai **15 tabel aplikasi** pada schema `public`:

- Operasional: `distributions`, `distribution_menu_items`, `daily_menu_plans`.
- Dokumen: `documents`, `bast_realisasi`, `bast_realisasi_items`, `counters`.
- Data Master: `settings`, `recipients`, `master_pengemudi`, `master_kendaraan`, `master_petugas`, `master_menu`.
- Keamanan/audit: `login_attempts`, `audit_log`.

Seluruh 15 tabel mengaktifkan RLS. Tidak ada policy tabel aplikasi untuk `anon` atau `authenticated`, dan kedua role tersebut tidak memiliki grant tabel. Akses data aplikasi dilakukan oleh backend tepercaya menggunakan kredensial server-side. Jangan membuka akses tabel dari browser atau menambahkan policy publik hanya untuk menghilangkan peringatan advisor.

Nomor SJ dan BAST memakai counter terpisah. Penerbitan nomor menggunakan RPC PostgreSQL atomik; penyimpanan distribusi/menu dan realisasi BAST menggunakan RPC agar data terkait konsisten. Snapshot dokumen yang sudah diterbitkan dilindungi dari perubahan.

### Storage

Bucket yang ditemukan di Supabase:

| Bucket | Akses | Batas saat ini | Kegunaan/keadaan |
|---|---|---:|---|
| `logo bgn` | Public | Tidak dibatasi pada konfigurasi bucket | URL logo yang digunakan frontend |
| `assets` | Public | 5 MB | Bucket aset gambar yang disediakan |
| `bast-ttd` | Private | 10 MB | Disiapkan untuk gambar/PDF scan BAST; alur upload dan signed URL belum tersedia di UI |

Jangan mengubah bucket, policy Storage, atau URL logo sebelum memeriksa referensi aktif. Jangan menjadikan bucket `bast-ttd` public.

## Invariants distribusi

- Rencana menu: daily_menu_plans, satu tanggal satu rencana, 1–8 komponen untuk rencana tersimpan, batch maksimal 20 tanggal hari ini/mendatang, pemeriksaan expected_updated_at.
- RPC autodoc_save_daily_plans dan autodoc_prepare_distribution menggunakan advisory lock per tanggal. Persiapan mengunci menu, waktu makan dan detail transportasi; konflik dikembalikan sebagai HTTP 409. Data terkunci digunakan kembali bila penerbitan parsial.
- RPC buat_dokumen_dengan_nomor mengalokasikan nomor SJ/BAST atomik dengan counter terpisah; unique index tetap berlaku. Nomor tidak direset ketika riwayat dihapus.
- Snapshot immutable menyimpan identitas, penerima, porsi dan distribusi historis. Organoleptik tidak mengonsumsi nomor.
- Transportasi: default_pengiriman pada record aktif, urutan urutan lalu nama/pelat; database mencegah record gabungan, duplikasi ter-normalisasi, default nonaktif dan gabungan default yang melampaui batas.
- Draf v4 membedakan transportasi default dari penggantian manual, menyimpan versi menu serta baris perencana yang belum tersimpan. Jangan menimpa rencana yang lebih baru.
- Realisasi BAST memakai RPC simpan_realisasi_bast; penghapusan riwayat memakai hapus_riwayat_distribusi dengan PIN ulang dan audit.

## Endpoint

Path dasar /functions/v1/autodoc-auth. Kontrak otoritatif adalah kode router dan handler di supabase/functions/autodoc-auth/index.ts. Endpoint data memerlukan sesi yang valid; mutasi sensitif memerlukan PIN ulang.

| Kelompok | Endpoint |
|---|---|
| Setup/auth | setup/status, setup/complete, auth/login, auth/session, auth/logout, auth/verify-token, auth/change-token |
| Master | master/list, master/recipients, master/save, master/numbering, master/import |
| Menu | menus/plans (GET tanggal/riwayat/daftar; POST batch) |
| Dashboard | dashboard/summary |
| Dokumen | docs/create, docs/days, docs/list, docs/mark-printed, docs/realization, docs/delete-history |
| AI lama | ai/analyze, ai/recipient-apply, ai/master-apply |

master/list?preview=true hanya mengembalikan numbering; docs/list?preview=true tidak mengambil realisasi BAST. Body umum 8 KiB; docs/create 1 MiB; AI memiliki batas tersendiri. Pembacaan JSON berbatas stream. HTTP 207 adalah keberhasilan parsial, bukan kegagalan transport; 409 konflik harus memicu pemuatan ulang konteks, bukan overwrite otomatis.

## Integrasi AI lama

OpenAI Responses API dari Edge Function, store:false, structured output; deadline provider 45 detik, Retry-After diteruskan untuk 429/503. Admission gate enam analisis per sesi per 10 menit dan dua permintaan aktif per isolate bukan kuota global. Analisis tidak menulis; apply memerlukan sesi, konfirmasi, validasi, snapshot terkini dan deduplikasi. Data sumber adalah input tidak tepercaya. Lihat [keamanan](../SECURITY.md).
