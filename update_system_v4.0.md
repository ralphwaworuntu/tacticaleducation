# Update System v4.0 — Tes Kecermatan Gambar Hilang

## Ringkasan

Menambahkan varian **Tes Kecermatan Gambar Hilang** dengan konsep yang sama seperti Angka Hilang dan Huruf Hilang: 5 referensi (A–E), tiap soal menampilkan 4 item, user memilih huruf item yang hilang.

---

## Fitur Baru

### Tes Kecermatan Gambar Hilang (`IMAGE`)

**Alur:**
1. Sistem memilih 5 gambar acak dari pool 15 ikon
2. Gambar referensi ditampilkan dengan label A–E
3. Deret soal menampilkan 4 gambar (1 hilang)
4. User menekan tombol A–E sesuai gambar yang tidak muncul

**Tampilan:** mengikuti mockup wireframe — border hitam, ikon line-art, header Kolom / Durasi / Skor.

---

## Perubahan Teknis

| Layer | File | Perubahan |
|---|---|---|
| Database | `schema.prisma`, migration `20260723153000_add_cermat_image_mode` | Enum `CermatMode` + `IMAGE` |
| Backend | `utils/cermat.ts` | Pool 15 icon keys, generator mode IMAGE |
| Backend | `exams.schemas.ts`, `exams.controller.ts` | Validasi mode IMAGE, answer max 32 char |
| Backend | `tryout.service.ts`, `admin.controller.ts` | PSIKO config mendukung Gambar Hilang |
| Frontend | `components/dashboard/CermatIcon.tsx` | 15 SVG ikon line-art |
| Frontend | `pages/dashboard/CermatPage.tsx` | UI gambar hilang + kartu tes baru |
| Frontend | `CermatHistoryPage.tsx` | Tab riwayat Gambar Hilang |
| Frontend | `AdminTryoutsPage.tsx` | Opsi PSIKO → Gambar Hilang |

---

## Test Plan

- [ ] Login member premium → `/app/tes-kecermatan`
- [ ] Klik **Mulai Tes Gambar** → countdown → tes dimulai
- [ ] Referensi 5 gambar + label A–E tampil
- [ ] Deret soal 4 gambar, tombol jawaban A–E berfungsi
- [ ] Timer habis → auto submit
- [ ] Riwayat → filter **Gambar Hilang** menampilkan sesi
- [ ] Admin → Pengaturan PSIKO → pilih **Gambar Hilang** tersimpan

---

## Catatan Deploy

Setelah pull, jalankan:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

Restart backend jika sedang berjalan.
