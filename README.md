# AutoDoc

Website administrasi distribusi MBG untuk SPPG Darmaraja 01. Aplikasi membantu operator menyiapkan Surat Jalan (SJ), BAST, formulir uji organoleptik, arsip distribusi, Data Master, dan pemetaan sumber data menggunakan asisten AI.

## Arsitektur dan teknologi

- **Frontend:** HTML, CSS, dan JavaScript vanilla; hosting utama diarahkan ke [Vercel](https://autodoc-xi.vercel.app/). GitHub Pages dipertahankan sementara sebagai jalur transisi.
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
- CORS hanya mengizinkan origin produksi `https://autodoc-xi.vercel.app` serta origin lama `https://admhubofficial-new.github.io` selama transisi. Origin lain ditolak; CORS bukan pengganti pemeriksaan sesi.
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

- Hosting utama: `https://autodoc-xi.vercel.app/`. Hubungkan Vercel ke repository ini dengan production branch `main`, Framework Preset Other, root repository, tanpa build framework; aset frontend memakai path relatif. GitHub Pages masih tersedia selama transisi. Verifikasi deployment Vercel sebelum menonaktifkan Pages.
- Edge Function `autodoc-auth` harus dideploy terpisah setelah perubahan backend disetujui dan siap dirilis.
- Pertahankan `verify_jwt=false` hanya selama pemeriksaan sesi/origin khusus di dalam fungsi tetap aktif.
- Verifikasi deployment Vercel, workflow Pages selama transisi, dan versi Edge Function secara terpisah; merge saja bukan bukti deployment berhasil.

### Workspace v2 (fase 1)
Modul Buat Dokumen, Arsip, dan Data Master tampil sebagai halaman dalam shell navigasi, bukan dialog layar penuh. Menu Realisasi BAST menyediakan antrean berdasarkan tanggal, pencarian nama dan filter status; formulir realisasi dan verifikasi PIN yang ada tetap dipakai. AI menu tetap menjadi dialog kontekstual agar input distribusi tidak hilang. Penerbitan, nomor, snapshot, API dan renderer cetak tidak berubah. Draf persisten, pelacakan pengiriman dan navigasi bawah mobile belum termasuk fase ini.

Fase stabilisasi: formulir distribusi dipertahankan selama sesi aktif, navigasi ditahan ketika penerbitan atau realisasi sedang disimpan, dan respons riwayat lama diabaikan. Draf ini hanya berada di memori halaman, bukan penyimpanan persisten.

### Workspace v2 (fase 2)
Navigasi cepat bawah untuk layar hingga 720 px, drawer tetap tersedia untuk Data Master dan Keluar. Ringkasan persiapan menghitung tujuan, porsi, dan jumlah SJ/BAST yang diminta (bukan jumlah terbit); pilihan keluaran dapat dibuka sesuai kebutuhan. Dashboard menonjolkan distribusi hari ini bila termasuk lima riwayat terbaru serta tanggal BAST tertunda yang tersedia dari API existing. Tidak mengubah database, nomor, renderer cetak atau autentikasi. Pengelolaan draf lintas reload dan antrean lintas seluruh riwayat belum ditambahkan.

### Workspace v2 (fase 3)
Draf distribusi disimpan di sessionStorage tab yang sama hingga 12 jam dan dapat dipulihkan setelah reload dengan sesi server yang valid. Draf bukan dokumen terbit; tidak menyimpan PIN/token, tidak mengirim data ke database, dibersihkan setelah logout, penerbitan sukses, atau pengosongan eksplisit. Data Master dimuat ulang dan penerima yang tidak lagi aktif tidak dipilih. Antrean BAST lintas tanggal memakai API existing, maksimal delapan tanggal per pemuatan dan tiga detail paralel; kegagalan dapat dicoba ulang tanpa melompati halaman. Hasil belum lengkap sampai semua halaman diperiksa. Setelah penerbitan, operator masuk ke konteks dokumen/arsip untuk mencetak. Tidak ada perubahan backend atau renderer cetak.

### Workspace v2 (fase 4)
Data Master tetap tersedia sebagai menu utama dalam kelompok Administrasi. Kategori desktop dan pilihan mobile dikelompokkan menjadi Data operasional, Pengaturan (Identitas SPPG), dan Bantuan input (Asisten AI). Identitas ditampilkan dalam formulir berkelompok tanpa tabel duplikat; Batal mengembalikan isian lokal tanpa menulis ke server. Cache/tampilan Data Master dibersihkan saat logout, respons pemuatan yang sudah tidak aktif diabaikan. Tab dokumen internal yang selalu disembunyikan dan helper tanpa referensi dihapus, aturan khusus navigasi yang saling menimpa dikonsolidasikan. Pengujian browser mencakup kategori desktop/mobile dan pembatalan edit. Tidak ada perubahan backend, skema, nomor dokumen, atau format cetak. Audit live dengan PIN, pengukuran performa produksi, dan pembersihan CSS menyeluruh tetap memerlukan verifikasi terpisah.

### Audit stabilitas dan cleanup
Kontrol cetak arsip dinonaktifkan selama detail tanggal dimuat, state dokumen lama dibersihkan; konfirmasi hapus hanya berlaku untuk pilihan yang sama, PIN dihapus dari DOM saat meninggalkan halaman, navigasi ditahan saat penghapusan berlangsung. Dashboard mengosongkan cache saat sesi ditutup, respons arsip lama dan hasil salin menu yang sudah kedaluwarsa diabaikan. Helper pilihan dan styling dari markup yang tidak lagi digunakan dihapus, render menu ganda dihilangkan. Backend, skema dan renderer cetak tetap utuh. Pengujian menggunakan mock, tidak ada mutasi produksi.

### AutoDoc 3.0 — tahap awal
Header horizontal desktop, dashboard tanpa kartu besar, formulir distribusi satu kolom dengan pratinjau tertutup awal dan konfirmasi penerbitan eksplisit. Pemilihan penerima banyak dibuka sesuai kebutuhan. Pengaturan > Nomor dokumen membaca counter SJ/BAST dan mengubah nomor berikutnya melalui sesi dan verifikasi PIN. RPC dikunci pada high-water mark, termasuk riwayat terhapus, serta mengaudit perubahan dalam transaksi. Terapkan migrasi dan deploy Edge Function sebelum merilis frontend. Nomor historis tidak diubah. Panel pemeriksaan terpisah dan tabel realisasi penuh masih tahap berikutnya.

### Rencana menu harian (Vercel)
Menu ditempatkan di awal Buat Dokumen. `daily_menu_plans` menyimpan maksimal delapan komponen per tanggal (satu menu per tanggal, mengikuti model distribusi existing); `menus/plans` memerlukan sesi aktif dan memakai service role hanya di backend. Rencana hari ini/mendatang dapat disimpan satu per satu atau batch hingga 20 tanggal. Riwayat rencana lampau tersedia melalui Arsip; menu dokumen terbit tetap menggunakan snapshot asli. Tanggal menu dan distribusi disinkronkan; berpindah tanggal tidak menyalin menu tanggal lain. Input cepat tanpa menyimpan rencana tetap dapat digunakan ketika menerbitkan dokumen. Tidak mengalokasikan nomor surat saat menyimpan rencana.

### P0 — sinkronisasi distribusi
Rencana menu dan persiapan distribusi menggunakan RPC dengan advisory lock per tanggal; versi rencana diverifikasi saat menyimpan. Formulir tanggal distribusi yang sudah disiapkan menggunakan data terkunci, bukan default atau draf lama. Rencana yang tersimpan dan berbeda dari draf tanpa versi cocok diprioritaskan; draf dapat dipulihkan secara eksplisit. Perubahan menu rencana harus disimpan sebelum terbit; input cepat pada tanggal tanpa rencana otomatis dicatat saat persiapan distribusi. Nomor pratinjau baru adalah perkiraan. Snapshot terbit tetap immutable. Draf v3 menyimpan versi menu dan baris perencana yang belum disimpan.
Distribusi yang sudah disiapkan dikunci meskipun penerbitan pertama belum selesai, sehingga permintaan bersamaan tidak dapat mengganti data perjalanan. Jika terjadi HTTP 409, formulir memuat ulang konteks tanggal. Jika penerbitan sebagian gagal, lanjutkan dengan data yang sama; perubahan data distribusi yang sudah disiapkan memerlukan alur penghapusan riwayat yang sudah tersedia dan konfirmasi operator.

### P1 — Master transportasi
Setiap pengemudi/kendaraan memiliki satu record. `default_pengiriman` pada record aktif menentukan isian awal surat (urutan `urutan`, lalu nama/pelat), melalui `master/list.data.transport_defaults`. Admin mengelola default pada Data Master → Pengemudi/Kendaraan; pilihan nonaktif tidak dapat menjadi default. Jenis kendaraan dipisah dari pelat. Data Master baru dari dokumen memecah pasangan transportasi menjadi record individual dan tidak otomatis mengubah default. Draf v4 membedakan nilai default dari penggantian manual; draf lama dengan nilai nonkosong dipertahankan sebagai perubahan manual bila berbeda dari default saat ini. Dokumen dan distribusi terkunci tidak ditulis ulang. Batas gabungan default dijaga database (180 karakter nama dan 80 karakter pelat).
