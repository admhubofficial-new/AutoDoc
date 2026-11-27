# AutoDoc — SPPG Darmaraja 01

Aplikasi administrasi distribusi MBG untuk membuat Surat Jalan (SJ), BAST, formulir uji organoleptik, mengelola realisasi dan arsip, serta Data Master.

**Aplikasi:** [AutoDoc Production](https://autodoc-xi.vercel.app/) · [GitHub Actions](https://github.com/admhubofficial-new/AutoDoc/actions)

## Alur singkat

1. Masuk menggunakan PIN operator.
2. Buka Buat Dokumen; pilih tanggal dan menu harian (atau rencanakan beberapa hari).
3. Pilih waktu makan, penerima, jenis dokumen, dan periksa detail pengiriman.
4. Periksa pratinjau lalu terbitkan; cetak dari arsip.
5. Lengkapi realisasi BAST setelah distribusi.

Pengemudi dan kendaraan default dikelola melalui Data Master. Distribusi yang sudah disiapkan terkunci; arsip memakai snapshot historis. Nomor resmi dialokasikan backend, bukan browser.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [Panduan operator](docs/operator.md) | Menu, penerbitan, cetak, realisasi, Data Master, pemulihan kesalahan |
| [Arsitektur dan kontrak API](docs/architecture.md) | Modul, skema, RPC, endpoint, sinkronisasi, performa |
| [Keamanan](SECURITY.md) | Sesi, RLS, secret, batas autentikasi, pelaporan |
| [Pengujian dan rilis](docs/runbook.md) | CI, deployment, migrasi, rollback, troubleshooting |
| [Riwayat perubahan](CHANGELOG.md) | P0–P5 dan riwayat workspace |
| [Panduan kontribusi](AGENTS.md) | Aturan kerja teknis dan invariants |

## Menjalankan pengujian lokal

Prasyarat: Node.js 22, Python 3, Deno 2.x. Jalankan dari root:

```sh
npm ci --ignore-scripts
npx --no-install playwright-core install chromium
npm test
npm run test:browser
deno check supabase/functions/autodoc-auth/index.ts
deno lint supabase/functions/autodoc-auth
```

Pengujian browser menggunakan API mock dan server lokal; jangan gunakan PIN atau database produksi. Untuk menjalankan frontend lokal tanpa API produksi, gunakan fixture browser test. Server produksi membatasi origin.

## Teknologi dan struktur

HTML/CSS/JavaScript vanilla, Vercel sebagai hosting utama, Supabase Edge Function Deno/TypeScript dan PostgreSQL. GitHub Pages dipertahankan sementara sebagai jalur lama.

```text
index.html, config.js         Shell, autentikasi, API client
documents*.js, document-*.js   Formulir, preview, renderer
daily-menu-planner.*           Perencana menu berdasarkan tanggal
archive.js, bast-realization.js Arsip dan realisasi BAST
master.js, master-utils.js     Data Master
dashboard.js                   Ringkasan
styles.css, theme.css          Layout dan design system
supabase/functions/            Edge Function
supabase/migrations/           Migrasi append-only
tests/                         Unit, contract, browser
.github/workflows/             CI
docs/                          Panduan teknis dan operasional
```

Tidak ada Google Sheets atau Apps Script dalam arsitektur aktif. Jangan menyimpan secret di repository. Lihat panduan rilis sebelum mengubah skema, autentikasi atau nomor dokumen.
