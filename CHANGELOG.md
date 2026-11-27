# Riwayat perubahan AutoDoc

[Beranda dokumentasi](README.md)

## 27 November 2026 — P0–P5

| Tahap | Perubahan |
|---|---|
| P0 | Sinkronisasi menu/distribusi, revision check, penguncian tanggal, pratinjau dan arsip. |
| P1 | Normalisasi record transportasi dan default yang dapat dikonfigurasi admin. |
| P2 | Konsolidasi API/tanggal Jakarta, pembersihan fungsi dan CSS usang. |
| P3 | Query paralel, payload preview minimal, request coalescing, reuse iframe, penghapusan index redundan. |
| P4 | Workflow kualitas dan keamanan, test browser terisolasi, perbaikan kontrak usang; 119 unit dan 29 browser lulus pada 21114cd. |
| P5 | README ringkas, panduan operator, arsitektur, keamanan, runbook, riwayat dan kebersihan repository. Tidak mengubah kode aplikasi atau database. |

## Riwayat sebelum konsolidasi P5

Bagian di bawah ini merupakan catatan historis yang dipertahankan untuk jejak perubahan, **bukan panduan keadaan aplikasi saat ini**. Untuk perilaku aktif, lihat README dan docs/.

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

### P3 — Performa
Permintaan baca identik yang masih berlangsung digabung di AutoDocCore; respons selesai tidak dicache. Mutasi dan event perubahan membatalkan reuse permintaan lama. `master/list?preview=true` hanya mengembalikan numbering; `docs/list?preview=true` tidak memuat realisasi BAST. Query master independen dijalankan paralel. Pratinjau mempertahankan iframe pada daftar penerima yang sama dan hanya mengganti isi jika jenis/snapshot/data dokumen berubah. Tombol coba lagi tersedia bila nomor gagal dimuat. Nomor pratinjau tetap perkiraan, penerbitan memakai validasi backend.

## Rekonsiliasi migrasi historis



File `20261121185410_delete_distribution_history.sql` sekarang menggunakan timestamp yang sama dengan baris `delete_distribution_history` pada `supabase_migrations.schema_migrations`. Isi file disamakan dengan statement SQL yang tercatat pada ledger produksi.

Rekonsiliasi ini hanya memperbaiki nama/path migrasi dalam repositori. Tidak ada statement migrasi yang dijalankan ke database produksi dan tidak ada perubahan pada tabel ledger produksi. Migrasi yang sudah diterapkan harus diperlakukan append-only.
