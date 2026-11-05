# Tactical Live Quiz

Kuis interaktif real-time (gaya Kahoot, branding & aset orisinal Tactical Education).
Tutor (ADMIN) membuat kuis dan membuka sesi; siswa bergabung dari HP lewat PIN/QR tanpa wajib login.
**Tidak ada tahap pembahasan/explanation** di mana pun (data, API, maupun UI).

## Ringkasan arsitektur

| Bagian | Lokasi | Catatan |
|---|---|---|
| Model database | `backend/prisma/schema.prisma` (`Quiz*`, `Live*`) | Migrasi aditif `20261104140000_add_live_quiz`; tidak menyentuh tabel lama |
| Skor & peringkat | `backend/src/modules/live-quiz/liveScoring.ts`, `liveRanking.ts` | Murni (pure), 45 unit test |
| Mesin permainan | `liveEngine.ts` | State machine di server; timer, skor, dan transisi **hanya** dihitung server |
| Gateway Socket.IO | `liveGateway.ts` | Namespace `/live`, path `/socket.io` |
| REST admin | `liveQuiz.admin.routes.ts` -> `/api/v1/admin/live-quiz/*` | `authenticate` + `authorize(['ADMIN'])` |
| REST publik | `liveQuiz.public.routes.ts` -> `/api/v1/live/*` | `pin/:pin`, `join`, `sessions/:id/me` |
| Frontend | `frontend/src/features/live-quiz/` | Admin, layar tutor (host), layar pemain; semua di-*lazy-load* |

Alur fase: `LOBBY -> COUNTDOWN -> QUESTION_ACTIVE -> QUESTION_RESULT -> SCORE_RESULT -> LEADERBOARD -> ... -> FINISHED` (atau `CANCELLED`).

### Aturan skor
- Mode **Kecepatan + ketepatan**: `t = waktu_jawab / durasi`; jika `waktu_jawab < 0,5 dtk` poin penuh, selain itu `round(max * (1 - waktu_jawab / (2 * durasi)))`.
- Mode **Ketepatan**: benar = poin penuh. Bobot soal: Normal 1x, Ganda 2x, Tanpa poin 0.
- Jawaban ganda (multiple) harus **cocok persis** (tidak ada nilai sebagian).
- Seri: poin -> jumlah benar -> waktu benar tercepat -> id (stabil).
- Waktu jawab memakai `receivedAt` di server; timestamp klien tidak dipercaya.

## Menjalankan di lokal

```powershell
# 1. MySQL (XAMPP) harus hidup, lalu:
cd backend
npm install
npx prisma migrate deploy      # menerapkan migrasi live quiz (aditif, aman)
npm run dev                    # http://localhost:5000

cd ../frontend
npm install
npm run dev                    # http://localhost:5173
```

1. Login sebagai ADMIN -> menu **LIVE QUIZ** di sidebar admin.
2. **Kuis Saya -> Buat kuis** (atau *Impor dari bank soal* Tryout/Latihan; kolom pembahasan tidak ikut diimpor).
3. **Mulai sesi** -> layar tutor terbuka (PIN + QR). Siswa membuka `/live/join` atau memindai QR.
4. Tutor menekan **Mulai**; atur laju dengan tombol Lanjut / Jeda / Akhiri.

### Agar HP bisa bergabung
- HP dan laptop harus satu jaringan Wi-Fi. Layar tutor otomatis mengganti `localhost` dengan IP LAN di QR.
- Di produksi, isi `APP_URL=https://domain-anda` di `backend/.env` supaya QR selalu memakai domain publik.
- Dev server Vite sudah mem-proxy `/socket.io` (WebSocket) sehingga HP cukup membuka `http://IP-LAN:5173`.
- Windows Firewall mungkin meminta izin untuk port 5173 / 5000 saat pertama kali.

## Pengujian

Tes **tidak pernah** memakai database asli. `backend/tests/setup.ts` memaksa nama database berakhiran `_test`
(default: `tactical_education_test`, diturunkan dari `DATABASE_URL`; bisa diganti dengan `TEST_DATABASE_URL`) dan menolak berjalan jika tidak.

```powershell
# Sekali saja: buat database kosong lalu terapkan migrasi ke DB tes
#   CREATE DATABASE tactical_education_test CHARACTER SET utf8mb4;
cd backend
$env:DATABASE_URL = "mysql://USER:PASS@localhost:3306/tactical_education_test"; npx prisma migrate deploy; Remove-Item Env:DATABASE_URL

npm test            # semua tes (unit + integrasi Socket.IO)
npm run test:unit   # hanya skor & peringkat
npx tsc --noEmit    # typecheck backend
```

Cakupan tes integrasi (klien Socket.IO sungguhan terhadap server nyata + DB tes): autentikasi/otorisasi, permainan penuh 3 pemain
(Single / Benar-Salah / Multiple), tidak ada kebocoran kunci jawaban sebelum soal ditutup, jawaban ganda/terlambat/double-Next,
reconnect, kick/lock/cancel, pemulihan setelah restart server, dan beban 37 pemain bersamaan.

Alat bantu uji manual UI (hanya untuk DB tes):
- `backend/tests/helpers/seedUiAdmin.ts` — membuat admin `lq-ui-admin@example.com` di DB tes.
- `backend/tests/helpers/liveBots.js` — bot pemain (avatar berbeda + reaksi acak): `node tests/helpers/liveBots.js <PIN> [baseUrl] [jumlahBot]`.
- `backend/tests/helpers/seedUiQuiz.js` — membuat kuis contoh + sesi di backend uji (mencetak PIN). **Login admin ini mengeluarkan sesi login admin lain di browser.**
- `backend/tests/helpers/migrateTestDb.ts` — menerapkan migrasi **hanya** ke DB tes (menolak nama DB tanpa `_test`).
- Menjalankan backend ke DB tes: `node -r ts-node/register/transpile-only -r ./tests/setup.ts src/server.ts`
  (port lain: `$env:PORT='5001'; $env:FRONTEND_URL='http://localhost:5174'`).
- Frontend untuk backend uji: `$env:DEV_PROXY_TARGET='http://127.0.0.1:5001'; npx vite --port 5174` (default proxy tetap ke `:5000`).

## Live Quiz 2.0 — tampilan game, avatar & reaksi emoji

**Tidak ada perubahan aturan skor, peringkat, timer, soal/jawaban, atau data lama.** Perubahan:

- **Tampilan**: tema game (navy/electric/emas + aksen), bentuk melayang, kartu jawaban berwarna **dengan bentuk + huruf** (aman untuk buta warna),
  hitung mundur, timer ring, hasil benar/salah, `TACTICAL LEADERBOARD`, dan podium `FINAL CHAMPIONS`
  (lampu panggung → podium 3 → avatar 3 → podium 2 → avatar 2 → podium 1 → piala/medali → konfeti). Tombol "Lewati animasi" tersedia.
- **16 avatar SVG** buatan sendiri (`frontend/src/features/live-quiz/avatars.tsx`): Explorer, Astronaut, Robot, Ninja, Pilot, Scientist, Fox, Panda, Owl, Tiger, Lion, Cat, Dragon, Gamer, Warrior, Student Hero.
  Alur gabung: PIN + nama → **pilih karakter** → `JOIN THE GAME` → lobby. Pilihan diingat di perangkat. Tutor bisa mengizinkan ganti avatar di lobby
  (`allowAvatarChange`); pemain hanya bisa mengganti avatarnya **sendiri**. Server hanya menyimpan **id** avatar (kolom `LivePlayer.avatarId`, nullable);
  pemain lama / id tak dikenal otomatis memakai avatar default deterministik (hash FNV-1a, sama di backend dan frontend).
- **Reaksi emoji** 🔥 ❤️ 😂 👏 🎉 😮 😎 🚀 (tanpa teks bebas), **tidak disimpan di DB** dan tidak memengaruhi skor/peringkat/timer.
  Aturan server (bukan hanya UI): lobby/hasil/skor/leaderboard/akhir boleh; saat soal aktif hanya setelah pemain mengirim jawaban (bisa dimatikan tutor);
  countdown dan sesi selesai/batal ditolak. Rate limit: jeda 3 dtk per pemain, maks 6 per 30 dtk, maks 60 per detik per sesi, dikirim ke layar tutor dalam batch 400 ms.
  Pemain hanya menerima jumlah agregat (tanpa nama); layar tutor menerima nama + avatar (hanya jika "Tampilkan di layar" aktif).
  Lane reaksi berada di tepi kanan layar tutor (maks 4 aktif, digabung bila emoji sama) sehingga tidak menutupi soal/jawaban/timer.
- **Kontrol tutor** (ikon reaksi di layar tutor): aktifkan/matikan reaksi, izinkan setelah menjawab, tampilkan/sembunyikan di proyektor. Default sesi diatur di
  *Pengaturan Live Quiz* dan *Mulai sesi* (4 setting baru: `reactionsEnabled`, `reactionsAfterSubmit`, `reactionsOnProjector`, `allowAvatarChange`).
- **Suara v2**: volume musik dan efek terpisah + mute; tetap disintesis via Web Audio dan hanya aktif setelah interaksi pengguna.
- **Gerak**: hanya `transform`/`opacity`. `prefers-reduced-motion`, setting "Aktifkan animasi" = mati, dan perangkat lemah otomatis memakai mode **lite**
  (tanpa bentuk melayang/blur/konfeti besar). Fungsi game tidak berubah di mode lite.
- **Database**: satu migrasi aditif `20261104220000_add_live_player_avatar` (`ALTER TABLE LivePlayer ADD COLUMN avatarId VARCHAR(32) NULL`). Tidak ada reset, tidak ada tabel baru.
  Setelah `git pull` di server jalankan `npx prisma migrate deploy` lalu `npx prisma generate`, kemudian restart backend.

### Cara menguji avatar & emoji (manual)
1. Backend uji + frontend uji (lihat atas), login `lq-ui-admin@example.com`, buat sesi dari *Kuis Saya → Mulai sesi*.
2. `node tests/helpers/liveBots.js <PIN> http://localhost:5001 20` → lobby tutor menampilkan 20 avatar berbeda.
3. Di HP / jendela lain buka `/live/join?pin=<PIN>`, isi nama, pilih karakter, `JOIN THE GAME`. Klik **Ganti karakter** → avatar di layar tutor ikut berubah. Refresh halaman → avatar tetap.
4. Tekan **REACT** (lobby / setelah menjawab) → emoji muncul di tepi kanan layar tutor; tekan lagi sebelum 3 dtk → ditolak (cooldown).
5. Di layar tutor buka ikon reaksi → matikan "Aktifkan reaksi" → tombol REACT di HP hilang; matikan "Tampilkan di layar" → lane kosong, HP tetap bisa bereaksi.

## Variabel lingkungan

| Variabel | Dipakai di | Fungsi |
|---|---|---|
| `APP_URL` | backend | Basis URL publik untuk QR/join dan izin CORS Socket.IO |
| `FRONTEND_URL` | backend | Daftar origin (dipisah koma) yang diizinkan CORS (produksi) |
| `DEV_PROXY_TARGET` | frontend (hanya dev) | Mengarahkan proxy Vite ke backend lain (default `http://127.0.0.1:5000`) |
| `VITE_API_URL` | frontend | Socket.IO memakai **origin yang sama** dengan API (`/socket.io` di host itu) |

Tidak ada variabel baru yang wajib. Pengaturan default Live Quiz disimpan di tabel `SiteSetting` (kunci `live_quiz_default_settings`).

## Deploy produksi (panduan — belum diterapkan)

> Konfigurasi produksi **tidak diubah** oleh pekerjaan ini. Langkah di bawah untuk Anda terapkan setelah menyetujuinya.

1. `git pull`, `npm ci` di backend & frontend, `npx prisma migrate deploy` (hanya menambah tabel), `npm run build` keduanya.
2. **Nginx** pada host `api.tacticaleducation.id`. Jangan pakai `Connection "upgrade"` untuk setiap permintaan: polling HTTP harus `Connection: close`, dan hanya permintaan yang membawa header `Upgrade` yang diteruskan sebagai WebSocket.

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    server_name api.tacticaleducation.id;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_buffering off;
    }
}
```

`FRONTEND_URL` harus memuat `https://app.tacticaleducation.id` (CORS Socket.IO juga mengizinkan origin itu secara eksplisit). Cloudflare atau proxy lain harus mengizinkan WebSocket pada subdomain API. Satu proses PM2 (bukan cluster).

3. **PM2: satu instance (fork mode)**. Ruang permainan disimpan di memori proses; menjalankan beberapa instance
   (cluster) akan memecah pemain & tutor ke proses berbeda.
   `pm2 start dist/server.js --name tactical-api` (jangan `-i max`).
   Jika suatu saat perlu banyak instance: pakai `@socket.io/redis-adapter` + sticky session, dan pindahkan runtime sesi ke Redis (belum dikerjakan).
4. Saat proses restart, sesi aktif dipulihkan dari DB (`recover()`); timer dihitung ulang dari deadline yang tersimpan.
5. Isi `APP_URL` dan `FRONTEND_URL` dengan domain produksi (HTTPS).

## Catatan keamanan

- Hanya ADMIN pemilik sesi yang bisa menjadi host (JWT diverifikasi saat handshake dan sesi dicek). Pemain memakai token acak; hanya hash SHA-256 yang tersimpan.
- Jawaban benar **tidak pernah** dikirim sebelum soal ditutup; ACK jawaban tidak mengungkap benar/salah atau poin.
- Semua event divalidasi zod; ada rate limit per-socket dan per-IP (join); nama pemain dibersihkan, teks soal dirender sebagai teks biasa + KaTeX (tanpa HTML mentah).
- Ekspor CSV memakai `csvSafeCell` (anti CSV-injection) dan BOM UTF-8.
- Hapus kuis yang pernah dimainkan diblokir (409) agar laporan lama tetap utuh.

## Batasan yang diketahui

- Satu instance server (lihat atas); tidak ada Redis adapter.
- Satu browser hanya bisa menjadi satu pemain per sesi (token disimpan di `localStorage` per sesi — itu juga yang memungkinkan reconnect).
- Audio disintesis lewat Web Audio API (tanpa berkas audio); browser mengharuskan interaksi pengguna sebelum suara dapat diputar.
- ESLint (aturan React 19 yang ketat) memberi beberapa peringatan di kode baru; kode lama sudah memiliki baseline masalah lint.
- Reaksi bersifat sementara (tidak ada riwayat/laporan reaksi). Reaksi yang terkirim saat tutor sedang tidak terhubung hilang.
- Pengujian Live Quiz 2.0 dilakukan dengan browser terintegrasi + bot socket; belum diuji di perangkat HP fisik, speaker/proyektor sungguhan, atau jaringan kelas dengan puluhan HP nyata.
