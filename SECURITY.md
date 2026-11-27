# Keamanan AutoDoc

[Beranda dokumentasi](README.md)

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

## Akses database dan Storage

RLS aktif pada seluruh 15 tabel aplikasi; role anon dan authenticated tidak memiliki grant langsung ke tabel maupun EXECUTE pada fungsi SQL aplikasi (audit 27 November 2026). Akses melalui Edge Function server-side. Jangan menambah policy publik untuk menghilangkan catatan advisor RLS tanpa policy. Untuk SECURITY DEFINER, gunakan search_path tetap, objek ber-schema dan revoke EXECUTE publik; berikan hak minimum.

Bucket bast-ttd tetap private. Jangan mencatat PIN, cookie, secret, dokumen penuh atau PII yang tidak diperlukan. Jangan menyimpan sesi browser di artifact CI. File AI diperlakukan sebagai data tidak tepercaya.

## Batas keamanan

PIN bersama bukan akun individu dan throttle browser tidak merupakan proteksi global terhadap serangan terdistribusi. Logout menghapus cookie sesi; rotasi PIN melalui mekanisme aplikasi membatalkan sesi lama melalui session_version. CORS bukan autentikasi. Pengujian mock tidak membuktikan seluruh integrasi produksi maupun keamanan menyeluruh.

## Pelaporan insiden

Laporkan secara privat kepada pengelola AutoDoc melalui saluran organisasi yang sudah disepakati. Jangan membuka issue publik yang memuat kredensial, data penerima, cookie atau langkah eksploitasi. Sertakan waktu kejadian, versi aplikasi, endpoint/fitur, dampak dan pesan error yang sudah disanitasi. Jika ada dugaan kebocoran, hentikan penggunaan kredensial yang terdampak, koordinasikan rotasi melalui dashboard resmi, dan simpan bukti dengan akses terbatas.
