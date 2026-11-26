# AutoDoc

Website administrasi distribusi MBG untuk SPPG Darmaraja 01. Aplikasi membantu operator menyiapkan Surat Jalan (SJ), BAST, formulir uji organoleptik, arsip distribusi, Data Master, dan pemetaan sumber data menggunakan asisten AI.

## Arsitektur dan teknologi

- **Frontend:** HTML, CSS, dan JavaScript vanilla; dipublikasikan melalui GitHub Pages.
- **Backend:** Supabase Edge Function `autodoc-auth` (Deno/TypeScript).
- **Database:** PostgreSQL/Supabase, dengan operasi browser selalu melalui Edge Function.
- **Integrasi:** Supabase REST/RPC/Storage, OpenAI Responses API dari server, dan Google Fonts (Inter).
- **Tidak digunakan:** Google Sheets dan Apps Script.

File frontend utama:
- `index.html`, `config.js`: bootstrap, login, shell aplikasi, navigasi, konfigurasi URL/publishable key.
- `dashboard.js`: ringkasan dan shortcut operasional.
- `documents.js`, `document-menu.js`, `document-preview.js`: alur pembuatan dokumen, editor menu, dan pratinjau.
- `documents-print.js`, `organoleptic-print.js`: keluaran cetak SJ/BAST dan uji organoleptik.
- `archive.js`, `bast-realization.js`: arsip distribusi dan realisasi BAST.
- `master.js`, `master-utils.js`, `ai-assistant.js`: Data Master, impor CSV, dan asisten AI.
- `styles.css`, `theme.css`: tampilan aplikasi.

Backend:
- `supabase/functions/autodoc-auth/index.ts`: endpoint API, autentikasi, validasi, operasi database, dan panggilan OpenAI.
- `session.ts`: cookie sesi dan identitas throttle yang ditandatangani HMAC.
- `validation.ts`: validasi input, pembacaan JSON berbatas stream, timeout HTTP, dan parsing Retry-After.
- `request-controls.ts`: admission gate AI per sesi dan per Edge Function isolate.
- `distribution-workflow.ts`: normalisasi aturan distribusi, jenis dokumen, waktu makan, dan komponen menu.

## Skema database dan akses

Database saat ini mempunyai **14 tabel aplikasi** pada schema `public`:

- Operasional: `distributions`, `distribution_menu_items`.
- Dokumen: `documents`, `bast_realisasi`, `bast_realisasi_items`, `counters`.
- Data Master: `settings`, `recipients`, `master_pengemudi`, `master_kendaraan`, `master_petugas`, `master_menu`.
- Keamanan/audit: `login_attempts`, `audit_log`.

Seluruh 14 tabel mengaktifkan RLS. Tidak ada policy tabel aplikasi untuk `anon` atau `authenticated`, dan kedua role tersebut tidak memiliki grant tabel. Akses data aplikasi dilakukan oleh backend tepercaya menggunakan kredensial server-side. Jangan membuka akses tabel dari browser atau menambahkan policy publik hanya untuk menghilangkan peringatan advisor.

Nomor SJ dan BAST memakai counter terpisah. Penerbitan nomor menggunakan RPC PostgreSQL atomik; penyimpanan distribusi/menu dan realisasi BAST menggunakan RPC agar data terkait konsisten. Snapshot dokumen yang sudah diterbitkan dilindungi dari perubahan.

### Storage

Bucket yang ditemukan di Supabase:

| Bucket | Akses | Batas saat ini | Kegunaan/keadaan |
|---|---|---:|---|
| `logo bgn` | Public | Tidak dibatasi pada konfigurasi bucket | URL logo yang digunakan frontend |
| `assets` | Public | 5 MB | Bucket aset gambar yang disediakan |
| `bast-ttd` | Private | 10 MB | Disiapkan untuk gambar/PDF scan BAST; alur upload dan signed URL belum tersedia di UI |

Jangan mengubah bucket, policy Storage, atau URL logo sebelum memeriksa referensi aktif. Jangan menjadikan bucket `bast-ttd` public.

## Login dan keamanan sesi

- Secret bootstrap dibaca hanya dari Supabase Edge Function Secrets dengan nama `PIN MASUK` (kode juga mengenali `PIN_MASUK`).
- Secret AI dibaca hanya dari server melalui nama `API OPEN AI AutoDoc`.
- PIN/token 6–128 karakter; database menyimpan hash dengan SHA-256 pre-hash dan bcrypt.
- Cookie sesi ditandatangani HMAC-SHA256, memakai `HttpOnly`, `Secure`, `SameSite=None`, dan `Partitioned`, dengan masa berlaku 12 jam.
- Validasi sesi memeriksa `session_version` sehingga rotasi PIN dapat membatalkan sesi lama.
- Lima kegagalan autentikasi berturut-turut mengunci percobaan pada identitas browser bertanda tangan selama 15 menit. Ini mencegah satu browser secara langsung mengunci seluruh operator. Karena aplikasi masih memakai PIN bersama, identitas tersebut bukan identitas personal; penghapusan cookie/browser data dapat menghasilkan identitas throttle baru. Ini bukan pengganti akun pengguna individual.
- CORS hanya mengizinkan origin `https://admhubofficial-new.github.io`. CORS bukan pengganti pemeriksaan sesi.
- Frontend hanya memuat publishable key. Jangan pernah menaruh `service_role`, `sb_secret`, PIN, atau API key OpenAI di frontend.

Edge Function menggunakan `verify_jwt=false` karena pemeriksaan origin, cookie sesi, dan PIN dilakukan di backend aplikasi. Jangan menghapus pemeriksaan tersebut.

## Fitur dan alur kerja

### Dashboard
Menampilkan ringkasan distribusi dan dokumen, BAST yang menunggu realisasi, kelengkapan Data Master, serta distribusi terbaru.

### Buat dokumen SJ/BAST
- Form pembuatan menggunakan **satu halaman**, bukan wizard tiga langkah.
- Pengguna memilih tanggal, waktu makan (pagi/siang/sore), maksimal delapan komponen menu, jenis dokumen, dan penerima secara eksplisit.
- Pratinjau mengikuti perubahan formulir.
- Data identitas SPPG, penerima, distribusi, menu, serta rincian porsi disimpan sebagai snapshot ketika dokumen diterbitkan.
- Nomor dibuat backend melalui RPC atomik. Retry penerbitan parsial tidak boleh membuat ulang nomor yang sudah berhasil.
- Penerbitan memerlukan sesi aktif; tidak meminta PIN kedua.
- Detail petugas, pengemudi, kendaraan, dan jam berangkat boleh kosong.

### Arsip dan cetak
- Arsip mendukung pencarian global, paginasi, pemilihan dokumen, dan cetak massal.
- Penghapusan riwayat dapat memilih beberapa distribusi dan memerlukan verifikasi PIN ulang. Operasi dibatasi 60 distribusi; counter nomor tidak di-reset.
- Status cetak dicatat melalui endpoint khusus setelah dialog cetak dipanggil dan dikonfirmasi sesuai alur aplikasi. Browser tidak dapat memastikan printer fisik benar-benar mencetak.
- Dokumen menggunakan snapshot historis, bukan Data Master terbaru.

### Realisasi BAST
Mencatat kondisi makanan, jam diterima, suhu, jumlah porsi diterima, ompreng, nama/jabatan penerima, dan catatan. Verifikasi PIN ulang dipertahankan; penyimpanan realisasi dan item menggunakan RPC transaksional.

### Formulir uji organoleptik
Keluaran A4 portrait, satu penerima per halaman, dengan pilihan menu/penilaian dan area tulis manual. Formulir ini tidak membuat nomor SJ/BAST dan tidak mengubah status dokumen.

### Data Master
Mencakup identitas SPPG, penerima manfaat, pengemudi, kendaraan, petugas, dan menu master. Impor CSV menerima delimiter koma, titik koma, atau tab, termasuk quoted fields dan UTF-8 BOM.

### Asisten AI
- Menerima teks atau hingga lima file dengan total ukuran file maksimal 6 MB di UI.
- Mendukung PDF, Word, Excel, CSV/TSV, TXT/Markdown, RTF, ODT, PowerPoint, JSON, HTML/XML, IIF, dan gambar JPG/JPEG/PNG/WebP.
- Menganalisis menu harian, penerima manfaat, dan data master seperti identitas SPPG, pengemudi, kendaraan, petugas, dan menu master.
- Analisis tidak menulis database. Hasil ditampilkan untuk diperiksa dan hanya diterapkan setelah pengguna memilih baris serta mengonfirmasi.
- Endpoint apply memeriksa sesi, konfirmasi eksplisit, snapshot data terkini, dan duplikasi.
- File sumber diperlakukan sebagai data tidak tepercaya; instruksi yang tertulis di dalam dokumen tidak boleh diikuti.
- OpenAI Responses API dipanggil dari Edge Function dengan `store: false` dan structured output. API key tidak pernah dikirim ke browser.
- Panggilan OpenAI memiliki deadline 45 detik. Respons 429/503 dipetakan ke pesan yang sesuai dan header `Retry-After` diteruskan.
- Admission gate membatasi enam analisis per sesi per jendela 10 menit dan maksimal dua permintaan aktif per Edge Function isolate. Batas ini melindungi worker dari burst, tetapi **bukan kuota global/billing yang persisten** karena status gate berada di memori isolate. Tetapkan usage/spend limits juga pada proyek OpenAI dan tinjau penggunaan secara berkala.

## Endpoint backend

Semua endpoint terdaftar di `supabase/functions/autodoc-auth/index.ts`:

- Setup/autentikasi: `setup/status`, `setup/complete`, `auth/login`, `auth/session`, `auth/logout`, `auth/verify-token`, `auth/change-token`.
- Data Master: `master/list`, `master/recipients`, `master/save`, `master/import`.
- AI: `ai/analyze`, `ai/recipient-apply`, `ai/master-apply`.
- Dashboard: `dashboard/summary`.
- Dokumen: `docs/create`, `docs/days`, `docs/list`, `docs/mark-printed`, `docs/realization`, `docs/delete-history`.

Batas body umum adalah 8 KiB. `docs/create` mempunyai batas khusus 1 MiB agar dapat menampung pemetaan menu delapan komponen untuk sampai 100 penerima. Semua body dibaca secara streaming dan ditolak segera ketika batas byte terlampaui.

## Migrasi Supabase

File `20261121185410_delete_distribution_history.sql` sekarang menggunakan timestamp yang sama dengan baris `delete_distribution_history` pada `supabase_migrations.schema_migrations`. Isi file disamakan dengan statement SQL yang tercatat pada ledger produksi.

Rekonsiliasi ini hanya memperbaiki nama/path migrasi dalam repositori. Tidak ada statement migrasi yang dijalankan ke database produksi dan tidak ada perubahan pada tabel ledger produksi. Migrasi yang sudah diterapkan harus diperlakukan append-only.

## Pengujian

Perintah utama:

```bash
npm test
npm run test:browser
deno check supabase/functions/autodoc-auth/index.ts
```

Unit/contract tests mencakup validasi, sesi, autentikasi, endpoint, body-size limits, streaming cancellation, timeout provider, Retry-After, admission gate, dan regresi fitur dokumen. Browser smoke tests menggunakan mock endpoint untuk memeriksa alur UI; pengujian mock bukan bukti integrasi produksi.

Jangan menjalankan test yang menulis, menghapus, atau mengonsumsi nomor dokumen di database produksi. Gunakan database lokal/disposable untuk pengujian integrasi PostgreSQL.

## Deployment

- Push ke `main` memicu deployment GitHub Pages.
- Edge Function `autodoc-auth` harus dideploy terpisah setelah perubahan backend disetujui dan siap dirilis.
- Pertahankan `verify_jwt=false` hanya selama pemeriksaan sesi/origin khusus di dalam fungsi tetap aktif.
- Verifikasi workflow Pages dan versi Edge Function secara terpisah; merge saja bukan bukti deployment berhasil.

### Workspace v2 (fase 1)
Modul Buat Dokumen, Arsip, dan Data Master tampil sebagai halaman dalam shell navigasi, bukan dialog layar penuh. Menu Realisasi BAST menyediakan antrean berdasarkan tanggal, pencarian nama dan filter status; formulir realisasi dan verifikasi PIN yang ada tetap dipakai. AI menu tetap menjadi dialog kontekstual agar input distribusi tidak hilang. Penerbitan, nomor, snapshot, API dan renderer cetak tidak berubah. Draf persisten, pelacakan pengiriman dan navigasi bawah mobile belum termasuk fase ini.

Fase stabilisasi: formulir distribusi dipertahankan selama sesi aktif, navigasi ditahan ketika penerbitan atau realisasi sedang disimpan, dan respons riwayat lama diabaikan. Draf ini hanya berada di memori halaman, bukan penyimpanan persisten.
