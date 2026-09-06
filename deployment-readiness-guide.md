# Deployment Readiness Guide (Points 1–5)

## 1. Target VPS & Runtime Environment
- **Identifikasi VPS**: Catat OS (mis. Ubuntu 22.04), RAM/CPU, serta akses SSH (user, port, key/password).
- **Runtime Node.js**: Pastikan versi Node sama dengan lingkungan dev (≥18). Gunakan `nvm` atau paket distro agar mudah update.
- **Dependensi Sistem**:
  - Git untuk pull kode
  - Build tools (`build-essential`, `python3`) bila perlu compile
  - Reverse proxy (Nginx) jika ingin TLS/HTTP2 atau multi app
- **Storage**: Sediakan direktori `/var/www/tactical` (contoh) untuk backend & frontend build dengan permission aman (owner spesifik).

## 2. Domain & DNS
- **Registrar**: Konfirmasi di mana domain dikelola (mis. Cloudflare, Niagahoster). Pastikan Anda punya akses untuk buat/mengubah record.
- **Record yang dibutuhkan**:
  - `A` record untuk IPv4 VPS (mis. `app.domain.com → 203.0.113.10`)
  - Jika ada panel admin terpisah, buat subdomain tambahan (`admin.domain.com`).
- **Propagation**: Uji dengan `nslookup`/`dig` setelah record dibuat untuk memastikan TTL & IP benar sebelum go-live.

## 3. Workflow Deploy
- **Mode manual** (default):
  1. SSH ke VPS.
  2. `git pull origin main` (atau rsync build folder jika tanpa git).
  3. Backend: `npm install && npm run build` → jalankan via PM2/ systemd.
  4. Frontend: `npm install && npm run build`, lalu serve via Nginx atau `pm2 serve dist 4173 --spa`.
- **CI/CD Opsional**: Integrasikan GitHub Actions/ GitLab CI untuk push ke VPS otomatis (mengurangi error manual).
- **Rollback plan**: simpan release sebelumnya (tag atau tarball) agar bisa revert cepat.

## 4. Database & Environment Variables
- **Database produksi**: Pastikan URL DB (MySQL/Postgres) aman & hanya dapat diakses dari VPS. Buat user khusus dengan hak minimum.
- **`.env` production**: Simpan di VPS (jangan commit). Minimal perlu:
  - `DATABASE_URL`
  - JWT secret/refresh secret
  - SMTP/Email service
  - `FRONTEND_URL`, `BACKEND_URL`
- **Migration & Seeding**:
  - Jalankan `npx prisma migrate deploy` setelah kode ter-copy.
  - Hindari `seed` penuh di produksi kecuali idempotent; untuk kalkulator cukup jalankan skrip seeding khusus (sekali saja).

## 5. Monitoring & Logging (Detail)
- **Process manager**: Gunakan PM2 / systemd agar app auto-restart.
  - Contoh: `pm2 start dist/server.js --name tactical-backend`
  - Simpan eksekusi dalam `ecosystem.config.js` agar mudah start/stop.
- **Log management**:
  - Aktifkan `pm2 install pm2-logrotate` atau gunakan logrotate Linux.
  - Simpan log penting (akses/error) max ukuran tertentu (mis. 10MB) dengan retensi 7–14 hari.
- **Monitoring resource**:
  - Paling dasar: `pm2 monit`, `htop`, `df -h`.
  - Opsional: pasang Netdata/Glances untuk dashboard real-time.
- **Alert/Error tracking**:
  - Minimal tail log error harian.
  - Ideal: integrasi Sentry, Logtail, atau layanan serupa agar error runtime memicu notifikasi.
- **Prosedur update**:
  - Pull → install → build → `pm2 restart tactical-backend` (graceful reload).
  - Dokumentasikan langkah ini agar konsisten dan dapat diotomasi.

---
Dengan mengikuti panduan di atas, poin 1–5 terpenuhi dan sistem siap di-host di VPS serta dipetakan ke domain produksi secara terkontrol.
