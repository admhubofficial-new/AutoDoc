# Panduan operator AutoDoc

[Beranda dokumentasi](../README.md) · [Buka aplikasi](https://autodoc-xi.vercel.app/)

## 1. Buat dokumen

- Masuk dengan PIN yang diberikan pengelola; jangan membagikannya melalui chat atau commit.
- Pada **Buat Dokumen**, pilih tanggal rencana menu. Tanggal distribusi ikut menyesuaikan.
- Input cepat untuk satu tanggal atau gunakan perencana untuk menyimpan sampai 20 tanggal sekaligus. Satu tanggal memuat maksimal delapan komponen, dengan urutan yang dipertahankan.
- Jika tanggal sudah mempunyai rencana, perubahan menu harus disimpan sebelum terbit. Tanggal lampau dengan rencana tersimpan hanya baca; riwayat tersedia dari Arsip.
- Pilih waktu makan (pagi/siang/sore), tujuan distribusi, dan jenis surat SJ/BAST. Organoleptik merupakan formulir tambahan, bukan nomor surat tersendiri.
- Detail petugas, pengemudi, kendaraan dan jam berangkat bersifat opsional. Periksa pengemudi dan kendaraan yang terisi dari default Data Master; ubah bila diperlukan sebelum distribusi disiapkan.
- Periksa pratinjau, jumlah tujuan dan porsi, lalu pilih Terbitkan Dokumen. Nomor pratinjau baru adalah perkiraan; nomor resmi diberikan server.

## 2. Data yang sudah terkunci dan draf

Distribusi dikunci sejak persiapan di server, termasuk bila penerbitan hanya berhasil sebagian. Untuk melanjutkan, buka tanggal yang sama dan gunakan data terkunci. Jangan membuat tanggal baru atau mengulang nomor manual untuk menyelesaikan kegagalan parsial.

Draf disimpan di sessionStorage tab yang sama hingga 12 jam. Draf bukan arsip dan tidak memuat PIN. Jika rencana server lebih baru, rencana server diprioritaskan; operator dapat memilih Pakai draf menu, meninjau perbedaan, lalu menyimpan. Logout, penerbitan sukses, atau pengosongan draf eksplisit menghapus draf. Default yang belum diedit mengikuti Data Master terbaru; penggantian manual draf v4 dipertahankan.

## 3. Pratinjau, arsip dan cetak

Gunakan tab SJ, BAST atau Organoleptik, kontrol tujuan dan zoom. Pada desktop, zoom kecil dapat menampilkan beberapa halaman berjajar; layar dapat digulir. Dokumen arsip mengikuti snapshot saat terbit, bukan nama pengemudi, penerima atau identitas SPPG terbaru.

Arsip mendukung pencarian, pemilihan dokumen dan cetak massal. Konfirmasi sudah dicetak hanya setelah hasil cetak diperiksa; aplikasi tidak mengetahui hasil printer fisik. Gunakan riwayat rencana menu untuk melihat rencana sebelumnya.

Penghapusan riwayat memerlukan PIN ulang dan konfirmasi pilihan, maksimal 60 distribusi per operasi. Penghapusan tidak mereset nomor. Jangan menghapus riwayat hanya untuk memperbaiki tampilan.

## 4. Realisasi BAST

Buka Realisasi BAST dan pilih dokumen yang masih membutuhkan realisasi. Isi kondisi makanan, waktu diterima, suhu, jumlah porsi diterima, ompreng, nama/jabatan penerima dan catatan. Periksa data serta konfirmasi PIN ulang sebelum menyimpan.

## 5. Data Master

Identitas SPPG, penerima, petugas, pengemudi, kendaraan, menu dan penomoran dikelola dari Data Master/Pengaturan. Setiap pengemudi atau kendaraan menggunakan satu record individual. Tandai Default pengiriman pada record aktif, atur urutan, lalu simpan. Jenis kendaraan dipisahkan dari nomor kendaraan. Buka ulang Buat Dokumen untuk memuat pengaturan terbaru.

Impor CSV mendukung delimiter koma, titik koma atau tab, quoted fields dan UTF-8 BOM. Tinjau data sebelum menerapkan perubahan. Nomor awal/berikutnya harus mengikuti batas backend dan memerlukan PIN ulang.

## 6. Bila terjadi masalah

| Gejala | Tindakan |
|---|---|
| Menu gagal dimuat | Klik Coba lagi; penerbitan diblokir sampai data tersedia. |
| Menu berubah di server | Muat ulang tanggal; tinjau draf sebelum menyimpan. |
| Nomor pratinjau belum tersedia | Klik Coba lagi pada panel pratinjau. |
| Data Master belum lengkap | Buka ulang Buat Dokumen; cek koneksi dan sesi. |
| Penerbitan sebagian berhasil | Buka arsip/tanggal yang sama dan lanjutkan dengan data yang sama. |
| Sesi berakhir | Masuk kembali. Jangan membagikan PIN. |
| Tampilan versi lama | Refresh paksa (Ctrl+F5), lalu cek status rilis. |

Jika masalah berulang, laporkan tanggal, tahap operasi, pesan kesalahan dan jenis perangkat. Hindari mengirim PIN, cookie, atau data pribadi penerima.
