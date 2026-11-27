# Runbook pengujian, deployment dan pemulihan

[Beranda dokumentasi](../README.md)

## Lingkungan

- Production frontend: [Vercel AutoDoc](https://autodoc-xi.vercel.app/), repository admhubofficial-new/AutoDoc, branch main, framework Other.
- [GitHub Pages lama](https://admhubofficial-new.github.io/AutoDoc/) masih dipertahankan sementara; jangan menonaktifkannya tanpa memeriksa pengguna dan origin yang masih aktif.
- Supabase: proyek AutoDoc, Edge Function autodoc-auth. Deploy backend terpisah. Jangan menggunakan proyek Nurfa untuk AutoDoc.

## Quality checks

Node.js 22, Python 3, Deno 2.x. Dari root:
```sh
npm ci --ignore-scripts
npx --no-install playwright-core install chromium
npm test
npm run test:browser
deno check supabase/functions/autodoc-auth/index.ts
deno lint supabase/functions/autodoc-auth
```

Pada Linux CI dapat digunakan playwright-core install --with-deps chromium. Workflow autodoc-quality.yml menjalankan unit/contract dan Chromium; security-tests.yml menangani Deno check/lint dan sintaks frontend. Workflow berjalan pada push main/PR; workflow kualitas juga mendukung dispatch manual. Tes browser memakai mock API, memblokir jaringan luar dan tidak mengalokasikan nomor produksi.

Baseline P4 terverifikasi pada commit 21114cd: [119 unit/contract + 29 browser, semuanya lulus](https://github.com/admhubofficial-new/AutoDoc/actions/runs/45967632748), [security check lulus](https://github.com/admhubofficial-new/AutoDoc/actions/runs/45967632788). Baseline ini bukan klaim otomatis bagi commit berikutnya.

## Checklist sebelum rilis

- [ ] Periksa scope diff dan dependensi; test yang terdampak harus ada.
- [ ] Semua CI yang relevan hijau pada commit yang akan dirilis; jangan menganggap READY sebagai hasil test.
- [ ] Untuk perubahan frontend, perbarui cache-busting aset terkait.
- [ ] Jika ada perubahan skema, cocokkan ledger produksi dan uji migrasi pada database lokal/disposable. Jangan menulis data uji di produksi.
- [ ] Jika backend berubah, cocokkan lima modul Edge Function dengan repository, pertahankan verify_jwt=false hanya dengan pemeriksaan origin/sesi khusus.
- [ ] Untuk perubahan cetak, periksa SJ, BAST dan Organoleptik A4, margin, page break, teks panjang, tanda tangan dan PDF.
- [ ] Catat perubahan, risiko dan cara pemulihan.

Gunakan feature branch dan PR untuk perubahan aplikasi. Jangan merge sebelum CI lulus. Vercel Git integration saat ini dapat merilis main secara independen dari CI; required deployment checks belum diaktifkan/dikonfirmasi. Jangan mengklaim release gate sudah bekerja. Konfigurasi gate hanya setelah memeriksa dukungan plan dan project, tanpa menambahkan kredensial produksi ke CI.

## Urutan perubahan lintas lapisan

1. Periksa migrasi, kompatibilitas data dan backup/restore yang tersedia.
2. Terapkan migrasi append-only yang kompatibel dengan versi lama, lalu verifikasi constraint/privilege.
3. Deploy backend yang kompatibel dan verifikasi versi/kode.
4. Rilis frontend setelah CI, lalu verifikasi alias produksi mengarah ke commit yang dimaksud.
5. Periksa status Pages (selama masih digunakan), log Vercel, log Edge Function, serta alur baca/preview secara aman. Jangan menerbitkan dokumen uji di produksi.

Migrasi yang telah diterapkan tidak diedit ulang. Bila ada drift, hentikan DDL sampai rekonsiliasi jelas. Jangan mengubah ledger secara manual.

## Pemulihan dan troubleshooting

| Masalah | Pemeriksaan |
|---|---|
| CI gagal | Buka job log, identifikasi assertion/bug aktual, perbaiki pada branch; jangan skip tes. |
| Vercel gagal | Periksa commit, build log, alias, project dan status deployment; jangan deploy berulang tanpa penyebab. |
| Frontend dan backend tidak sinkron | Cocokkan source Edge Function dan commit, lalu deploy versi kompatibel. |
| Konflik 409 / menu | Muat ulang tanggal, jangan menimpa data terkunci. |
| Kegagalan penerbitan parsial | Lanjutkan tanggal dan data yang sama; nomor lama tidak dibuat ulang. |
| Sesi/origin | Periksa cookie, origin yang diizinkan, status sesi; jangan melemahkan pemeriksaan keamanan. |

Jika rilis frontend menyebabkan regresi serius, verifikasi deployment sebelumnya yang kompatibel di Vercel dan gunakan rollback/promotion sesuai kontrol platform. Rollback frontend tidak membalikkan migrasi maupun backend; jangan menjalankan down migration yang menghapus data atau mengubah nomor. Untuk backend, gunakan commit sebelumnya yang kompatibel dengan schema aktif. Utamakan perbaikan maju untuk perubahan database.

Catat waktu, commit, deployment, versi Edge Function, migrasi, hasil CI dan risiko yang tersisa. Jangan menganggap tidak adanya log error sebagai bukti tidak ada bug.
