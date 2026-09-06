# Update System v3.9 — Perbaikan Alur Mulai Tryout & Latihan Soal

## Ringkasan

Perbaikan bug alur navigasi saat member menekan **Mulai Tryout** / **Mulai Latihan Soal** dari halaman detail. Scope: **frontend only**, tidak ada perubahan database atau backend API.

---

## List Update Bug and Features

### 1. [Bug] Redirect prematur ke halaman pengerjaan

**Masalah:**
Tombol "Mulai Tryout" / "Mulai Latihan" di halaman detail ujian langsung memindahkan user ke `/app/.../mulai` sebelum konfirmasi fullscreen dan countdown selesai.

**Perilaku diharapkan:**
User tetap di halaman detail hingga:
1. Popup konfirmasi fullscreen (jika browser mendukung)
2. Countdown persiapan selesai
3. Baru redirect ke halaman pengerjaan dengan `skipCountdown=1`

**File yang diubah:**
- `frontend/src/pages/dashboard/ExamTryoutDetailPage.tsx`
- `frontend/src/pages/dashboard/ExamPracticeDetailPage.tsx`
- `frontend/src/pages/dashboard/ExamTryoutPage.tsx` (dukungan `skipCountdown`)
- `frontend/src/pages/dashboard/ExamPracticePage.tsx` (dukungan `skipCountdown`)

**Catatan:** Halaman latihan (`TryoutDetailPage`, `PracticeDetailPage`) sudah memiliki alur yang benar sejak v3.8.

---

### 2. [Bug] Countdown ganda (5 detik muncul dua kali)

**Masalah:**
Klik "Mulai Tryout" di detail ujian → countdown di halaman mulai → kembali ke konfirmasi fullscreen → countdown lagi.

**Perbaikan:**
Countdown hanya dijalankan **sekali** di halaman detail. Halaman `/mulai` menerima flag `skipCountdown=1` dan langsung memulai sesi tanpa countdown ulang.

**Alur baru (state machine):**
```
idle → fullscreenGate → countdown → navigate(mulai?skipCountdown=1) → startSession
```

---

### 3. [Bug] Tombol kembali loncat ke halaman awal

**Masalah:**
Tombol "Kembali" di detail latihan soal memakai hardcoded path ke daftar set, bukan 1 step history.

**Perbaikan:**
`PracticeDetailPage.tsx` — tombol kembali menggunakan `navigate(-1)`.

Halaman detail lainnya (`TryoutDetailPage`, `ExamTryoutDetailPage`, `ExamPracticeDetailPage`) sudah memakai `navigate(-1)`.

---

## Test Plan

### Akun uji
- Member premium: `premium@tacticaleducation.id` / `Premium@123`

### Latihan Tryout (`/app/latihan/tryout/detail/:slug`)
- [ ] Klik "Mulai Tryout" → tetap di halaman detail
- [ ] Popup fullscreen muncul (Chrome/Edge)
- [ ] Setelah konfirmasi → countdown 5 detik
- [ ] Setelah countdown → sesi tryout dimulai (tanpa countdown kedua)
- [ ] Tombol "Kembali" → kembali 1 halaman sebelumnya

### Ujian Tryout (`/app/ujian/tryout/detail/:slug`)
- [ ] Alur sama seperti latihan tryout
- [ ] Tidak ada redirect ke `/mulai` sebelum countdown selesai

### Latihan Soal (`/app/latihan-soal/detail/:slug`)
- [ ] Klik "Mulai Latihan Soal" → alur fullscreen + countdown di detail
- [ ] Tombol "Kembali" → `navigate(-1)`

### Ujian Soal (`/app/ujian/soal/detail/:slug`)
- [ ] Klik "Mulai Ujian Soal" → alur fullscreen + countdown di detail
- [ ] Sesi dimulai tanpa countdown ganda

### Regresi
- [ ] Mulai tryout dari halaman list (bukan detail) tetap berfungsi
- [ ] Tidak ada error di console browser (F12)
- [ ] Backend terminal tidak error saat start session

---

## Out of Scope (v3.9)

- Redesign UI landing page
- Perubahan schema database
- Deploy production/VPS
