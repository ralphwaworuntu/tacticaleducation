**Project: Website Bimbel & Dashboard Tryout – “TACTICAL EDUCATION”**

Buatkan sebuah aplikasi web progresive app bernama **“TACTICAL EDUCATION”** yang terdiri dari:

1. **Landing page publik** (seperti contoh Kelas Bimbel pada gambar 1,2,3,4,5,6)
2. **Sistem register & login**
3. **Dashboard member** lengkap dengan fitur Tryout, Latihan Soal, Tes Kecermatan, Materi, Paket Membership, dan Afiliasi.

---

### 1. Teknologi & Hosting (VERSI VPS – MODERN STACK)

Aplikasi akan berjalan di VPS (bukan shared hosting). Gunakan arsitektur **frontend–backend terpisah**:

#### Backend (API Server)

* **Runtime:** Node.js 20+  
* **Framework:** Express.js untuk membangun REST API  
* **ORM / Query Builder:** Prisma (disarankan) atau Sequelize  
* **Database:** MySQL 8 / MariaDB 10.5+  
* **Autentikasi:** JWT (access token + refresh token)  
* **Hashing Password:** bcrypt  
* **Validasi & Keamanan:**
  * Validasi input (Zod / express-validator)
  * Middleware auth (proteksi route berdasar role)
  * Rate limiting untuk endpoint sensitif (login, register)
  * CORS configuration untuk frontend React
* **Konfigurasi:** gunakan file `.env` (PORT, DATABASE_URL, JWT_SECRET, dsb.)

#### Frontend (SPA Landing Page + Dashboard)

* **Framework:** React + TypeScript  
* **Build Tool:** Vite  
* **Styling:** Tailwind CSS 3  
* **UI Components:** shadcn/ui  
* **Routing:** React Router untuk memisahkan halaman publik & dashboard member  
* **State Management:** React Query (TanStack Query) untuk data fetching + caching, serta Context/Zustand untuk state auth (token, user info)

#### Infrastruktur & Deployment

* **Server OS:** Ubuntu 22.04 LTS (atau setara)  
* **Web Server / Reverse Proxy:** Nginx  
  * Domain utama untuk frontend `tacticaleducation.id`  
  * Subpath atau subdomain API `tacticaleducation.id/api` atau `api.tacticaleducation.id`
* **Running Backend:** PM2 (process manager) untuk menjalankan Node.js secara daemon  
* **Frontend:**
  * Build dengan `npm run build` → hasil folder `dist` diserve statis oleh Nginx
* **Keamanan HTTPS:** SSL dengan Let’s Encrypt (Certbot) di Nginx

Pastikan:

* Proses build frontend dilakukan sebelum deploy (VPS hanya menyajikan file statis + API Node.js).
* Konfigurasi environment mudah diatur via `.env` (backend) dan `.env` front-end (misal `VITE_API_URL`).
* Tidak bergantung pada background worker terpisah, cukup Node + PM2 di VPS.

---

### 2. Autentikasi & Role

Buat sistem autentikasi lengkap:

* **Register (Daftar)** dan **Login**.
* Password di-hash (bcrypt).
* Validasi input (email unik, password minimal 8 karakter, dll).
* Setelah register & login berhasil, user diarahkan ke **Dashboard Tactical Education**.
* Gunakan JWT:
  * Access token untuk akses API
  * (Opsional) Refresh token untuk memperpanjang sesi

Role minimal:

1. **Admin**

   * Mengelola user.
   * Mengelola konten landing page (profil, paket bimbel, galeri, testimoni, dll).
   * Menginput & mengedit soal Tryout, Latihan Soal, Tes Kecermatan (jika ada konfigurasi), Materi, Paket Membership, dan Transaksi.

2. **Siswa / Member**

   * Mengikuti Tryout.
   * Mengerjakan Latihan Soal.
   * Mengerjakan Tes Kecermatan “Angka Hilang”.
   * Mengakses materi sesuai paket.
   * Melihat riwayat hasil & riwayat transaksi.
   * Mengakses halaman profil akun sendiri.

Tabel utama (silakan buat skema DB / migration):

* `users` (id, name, email, password_hash, role, created_at, updated_at)
* Tabel lain mengikuti modul-modul di bawah.

---

### 3. Struktur Navigasi Umum

Website dibagi 2 bagian:

1. **Bagian Publik (tanpa login)** → Landing page dengan navbar di atas.
2. **Bagian Member (setelah login)** → Dashboard dengan sidebar “TACTICAL EDUCATION”.

---

## BAGIAN A – LANDING PAGE PUBLIK

### 4. Navbar Utama (Top Navigation)

Di semua halaman publik tampilkan navbar dengan:

* Logo di kiri (tulisan “TACTICAL EDUCATION” atau logo placeholder).
* Menu:

  * Home
  * Profil
  * Paket Bimbel
  * Galeri
  * Testimoni
  * Hubungi Kami

* Di kanan navbar:

  * Tombol **“DAFTAR”** → menuju halaman Register.
  * Tombol **“LOGIN”** → menuju halaman Login.

Style dan layout navbar **diupayakan mirip seperti contoh Kelas Bimbel** yang diberikan (warna oranye, background putih, font sederhana, tombol daftar/login berwarna oranye dengan border radius).

---

### 5. Halaman **Home**

Buat layout **mirip gambar referensi**:

1. **Hero Section (Banner Utama)**

   * Background foto/ilustrasi personel POLRI/TNI/CPNS (boleh placeholder).
   * Headline:

     * “Bimbel Online Terbaik”
     * “No. 1 Indonesia” (bisa diganti copywriting yang sejenis).

   * Subheadline singkat: misalnya ajakan bergabung untuk lolos tes POLRI/TNI/Kedinasan/CPNS.
   * Dua tombol:

     * **“GABUNG SEKARANG”** (link ke register).
     * **“PAKET BIMBEL”** (scroll ke section Paket Bimbel di halaman home / ke halaman Paket Bimbel).

2. **Section Statistik (4 Kotak Angka)**

   * Kotak-kotak horizontal seperti di contoh:

     * Materi Video / Materi
     * Soal Try Out
     * Jumlah Alumni
     * Modul

   * Setiap box: ikon, label, dan angka (misalnya +1.200, +4.500, +724, +35; bisa diubah di admin).

3. **Section “Kenapa Harus Bimbel?” & “Kenapa Harus Pilih Tactical Education?”**

   * Satu section dengan foto mentor di kiri dan list poin masalah di kanan (kurangnya informasi pendaftaran, kuota terbatas, kurang latihan soal, dll).
   * Section berikutnya berisi keunggulan Tactical Education dalam bentuk icon + bullet point (pendampingan intensif, soal terupdate, materi terkurasi, simulasi CAT, dll) disusun dalam grid 2–3 kolom seperti contoh.

4. **Section “Paket Bimbel” di Home**

   * Grid kartu untuk:

     * Tes Masuk Polri
     * Tes Masuk Kedinasan

   * Setiap kartu berisi:

     * Judul paket.
     * Deskripsi singkat.
     * Tombol “CLICK HERE” atau “DAFTAR DISINI” (link ke detail paket/loginkan pengguna jika belum login).

5. **Section “Kelas Bimbel Itu Apa Sih?”**

   * Dua kolom teks menjelaskan tentang lembaga bimbel (bisa pakai dummy text, tapi struktur paragraf seperti contoh: apa itu Tactical Education, misi, fokus pada tes POLRI/TNI/Kedinasan/CPNS, dan keunggulan sistem belajar).

6. **Footer**

   * Menampilkan:

     * Logo Tactical Education.
     * Menu singkat (Daftar Paket, Testimoni).
     * Links: Tentang Kami, Butuh Bantuan?
     * Info kantor (alamat, email, nomor WhatsApp).

   * Tambahkan teks kecil: “Powered by Tactical Education”.
   * Tambahkan icon/tombol WhatsApp mengambang di pojok kanan bawah (floating button) yang membuka link WA.

---

### 6. Halaman **Profil**

* Judul besar: “Profil Kami”.
* Konten berupa paragraf panjang yang menjelaskan:

  * Tactical Education sebagai solusi belajar untuk casis POLRI, TNI, Kedinasan, CPNS, dll.
  * Sejarah singkat (tahun berdiri, misi).
  * Pendekatan pembelajaran (latihan bersama, sistem adaptif, humanis, dsb).

* Layout mengikuti contoh: header oranye di bagian atas dengan judul, kemudian teks di tengah, lalu footer yang sama seperti halaman lain.

---

### 7. Halaman **Paket Bimbel**

* Judul: “Paket Bimbel”.
* Subjudul singkat menjelaskan bahwa Tactical Education menawarkan paket untuk berbagai tes (Polri, TNI, Kedinasan, CPNS, UTBK).
* Grid kartu paket seperti di contoh:

  * Tes Masuk Polri
  * Tes Masuk TNI
  * Tes Masuk Kedinasan
  * Tes Masuk CPNS
  * Tes Masuk UTBK

* Setiap kartu:

  * Gambar background.
  * Judul.
  * Deskripsi singkat.
  * Tombol “DAFTAR DISINI” / “CLICK HERE”.

* Kartu “Coming Soon” bisa ditandai dengan label di pojok (jika ada paket belum aktif).

---

### 8. Halaman **Galeri**

* Judul: “Foto Alumni”.
* Section slider / grid berisi foto-foto alumni dengan desain banner ucapan “Selamat & Sukses”.
* Section “Kegiatan Bimbel” berisi beberapa foto kegiatan (grid).
* Section “YouTube” berisi embed video YouTube (grid 2–3 kolom) seperti contoh.
* Footer sama dengan halaman lainnya.

---

### 9. Halaman **Testimoni**

* Judul: “Testimoni dari Para Alumni Tactical Education”.
* Section carousel testimoni (gambar story + teks).
* Section cards testimoni teks singkat (seperti screenshot chat/komentar).
* Section “Video Testimoni” berisi beberapa video embed (atau placeholder video) dalam grid.
* Footer seperti biasa.

---

### 10. Halaman **Hubungi Kami**

* Judul: “Hubungi Kami”.
* Tampilkan:

  * Foto mentor di sebelah kiri (atau gambar representatif).
  * Di kanan: teks “Konsultasi Sekarang” + nomor telepon/WhatsApp + alamat lengkap kantor.

* Tambahkan **form kontak sederhana** (optional tapi diutamakan):

  * Nama, Email, Pesan, tombol “Kirim”.

* Footer sama seperti halaman lain.

---

## BAGIAN B – DASHBOARD MEMBER “TACTICAL EDUCATION”

Setelah user login (role member), arahkan ke **Dashboard** dengan layout sidebar di kiri dan konten di kanan.

### 11. Sidebar Menu (WAJIB SESUAI URUTAN INI)

Sidebar kiri berisi menu:

1. **Dashboard**
2. **Pengumuman**
3. **FAQ**
4. **Berita**
5. **Kalkulator Psikologi**
6. **Ujian** (section/group)

   * **Tryout**
     * Submenu:
       * **Tryout** (daftar paket tryout)
       * **Riwayat Tryout**
   * **Latihan Soal**
   * **Tes Kecermatan** ✅ (menu baru, tepat di bawah Latihan Soal)

7. **Materi**
   * **Modul / Materi**

8. **Beli Paket**
   * **Paket Membership**
   * **Riwayat Transaksi**

9. **Member Get Member**
   * **Afiliasi**

**Catatan penting:**  
Menu **“Video Pembelajaran”** dan **“Ruang Kelas”** **tidak boleh ada** di sidebar.

---

### 12. Halaman **Dashboard** (Setelah Login)

Tampilkan:

* Banner kecil / welcome text dengan nama user.
* **Tabel Riwayat Transaksi Terbaru**:
  * Kolom: No, Kode, Keterangan, Tanggal, Metode Pembayaran, Status, Action (detail).
* **Tabel Pengumuman**:
  * Kolom: No, Perihal, Action (lihat detail).
* Bisa ditambah card statistik (jumlah tryout yang pernah dikerjakan, skor terbaik, dsb).

---

### 13. Modul **Pengumuman, FAQ, Berita, Kalkulator Psikologi**

* **Pengumuman**: list dan detail. Admin CRUD.
* **FAQ**: list Q&A. Admin CRUD.
* **Berita**: seperti blog (judul, tanggal, isi). Admin CRUD.
* **Kalkulator Psikologi**:
  * Minimal satu kalkulator sederhana (misal skoring dari beberapa pertanyaan).
  * Setelah submit, tampilkan skor + interpretasi.
  * Struktur kode dibuat agar ke depan bisa ditambah jenis kalkulator lain.

---

### 14. Modul **Ujian**

#### 14.1 Tryout

**Halaman List Tryout (submenu “Tryout”):**

* Menampilkan daftar paket tryout dalam bentuk **card grid**.
* Isi card:
  * Nama Tryout.
  * Kategori (Polri, TNI, CPNS, Kedinasan, UTBK, Psikologi, Akademik, dll).
  * Deskripsi singkat.
  * Tombol **“Kerjakan”** / **“Lihat Detail”**.

**Detail Tryout & Pelaksanaan:**

* Tampilkan informasi tryout + tombol **“Mulai Tryout”**.
* Saat mulai:
  * Tampilkan soal pilihan ganda (minimally).
  * Timer (misal 90 menit – bisa diset di database).
  * Navigasi soal berikut/previous.
  * Simpan jawaban user di `tryout_answers`.
* Setelah selesai:
  * Hitung skor = jumlah benar / total soal × 100.
  * Simpan ke `tryout_results` (user_id, tryout_id, skor, tanggal).
  * Tampilkan hasil ke user.
  * Buat tombol navigasi dan arahkan ke halaman **Review/pembahasan** terkait soal tryout yang sudah dikerjakan (admin diwajibkan untuk memasukkan detail pembahasan dari setiap soal).

**Riwayat Tryout (submenu “Riwayat Tryout”):**

* Tabel:
  * No, Kategori, Judul Tryout, Tanggal Pengerjaan, Skor, Action (detail).

**Admin Panel Tryout:**

* CRUD kategori tryout.
* CRUD paket tryout.
* CRUD bank soal tryout.

---

#### 14.2 Latihan Soal

* Halaman utama menampilkan **kategori** sebagai kartu:
  * POLRI, TNI, CPNS, KEDINASAN, UTBK/SNBT.
* Klik kategori → masuk ke daftar paket latihan soal.
* Mekanisme pengerjaan:
  * Soal pilihan ganda.
  * Tidak wajib pakai timer (boleh ada).
  * Setelah selesai, tampilkan jumlah benar/salah dan pembahasan (jika tersedia).
  * Boleh simpan riwayat latihan sederhana.

Struktur database bisa menggunakan tabel terpisah, misalnya:

* `practice_categories`, `practice_sets`, `practice_questions`, `practice_answers`, `practice_results`.

---

#### 14.3 Tes Kecermatan – **Angka Hilang**

Menu **“Tes Kecermatan”** ditempatkan tepat di bawah “Latihan Soal”.

**Fitur yang harus ada:**

* Halaman intro:
  * Penjelasan singkat Tes Kecermatan “Angka Hilang”.
  * Tombol **“Mulai Latihan”**.

* Mekanisme latihan:
  * Sistem otomatis menghasilkan deret angka dengan satu angka hilang (pattern aritmetika sederhana).
    * Contoh: 2, 4, 6, __, 10 → jawaban 8.
  * User mengisi jawaban angka pada input field.
  * Jumlah soal per sesi misal 60 soal (konfigurabel).
  * Diberikan timer 1 menit.
  * Berulang sebanyak 10 sesi (Jadi total 10 menit - 600 soal).

* Setelah selesai:
  * Hitung jumlah jawaban benar.
  * Tampilkan skor + kategori (Sangat Baik / Baik / Cukup).
  * Simpan riwayat ke tabel `cermat_sessions` dan `cermat_answers`.

Soal tidak perlu diinput manual oleh admin, cukup di-generate secara programatis.

---

### 15. Modul **Materi → Modul / Materi**

* Halaman list materi:
  * Filter berdasarkan kategori (Polri, TNI, CPNS, Kedinasan, UTBK).
  * Kolom: Judul, Kategori, Tipe (PDF/Video/Link), Action (Download/Lihat).

* Admin Panel:
  * Upload file (PDF, PPT, dll) ke folder tertentu di server.
  * Input metadata ke tabel `materials` (judul, deskripsi, file_path, kategori, tipe).

---

### 16. Modul **Beli Paket → Paket Membership & Riwayat Transaksi**

* **Paket Membership:**
  * List paket keanggotaan (misal Silver, Gold, Platinum atau per jenis tes).
  * Informasi: nama paket, harga, durasi, fasilitas.
  * Tombol “Beli Paket”.

* **Riwayat Transaksi:**
  * Tabel: No, Kode, Keterangan, Tanggal, Metode, Jumlah, Status, Action.

* Untuk versi awal, pembayaran cukup manual:
  * User isi form konfirmasi pembayaran (upload bukti transfer optional).
  * Admin mengubah status transaksi (Pending / Lunas / Ditolak).

---

### 17. Modul **Afiliasi (Member Get Member)**

* Setiap user mempunyai **kode referral** unik.
* Tabel `referrals`:
  * referrer_id, referred_user_id, tanggal_daftar, status.

* Halaman Afiliasi:
  * Menampilkan kode referral & link pendaftaran dengan parameter `?ref=KODE`.
  * Tabel daftar member yang bergabung melalui referral tersebut.

---

### 18. Kualitas Kode & Output yang Diharapkan

* Kode rapih, terstruktur, dan mudah dikembangkan.
* Proteksi & keamanan:
  * Validasi input di backend.
  * Sanitasi data untuk mencegah SQL injection, XSS, dll.
  * JWT dengan secret yang aman.
  * Rate limiting pada endpoint login & register.
* Sertakan:
  * Struktur project lengkap (frontend dan backend terpisah).
  * File konfigurasi contoh (`.env.example` backend dan `.env.example` frontend).
  * Migration/Prisma schema atau file `.sql` untuk semua tabel.
  * Instruksi singkat deploy di VPS:
    * setup Node, PM2, Nginx, SSL
    * perintah build frontend & start backend.

---

**Tujuan akhir:**  
Saya ingin mendapatkan paket source code lengkap untuk website **TACTICAL EDUCATION** yang:

* Memiliki landing page publik modern (seperti contoh Kelas Bimbel).
* Memiliki sistem register & login.
* Setelah login, user masuk ke dashboard dengan fitur Tryout, Latihan Soal, Tes Kecermatan “Angka Hilang”, Materi, Paket Membership, Riwayat Transaksi, dan Afiliasi.
* Menggunakan stack modern (Node.js + Express + MySQL di backend, React + TypeScript + Vite + Tailwind + shadcn/ui di frontend) dan siap di-deploy di VPS.
