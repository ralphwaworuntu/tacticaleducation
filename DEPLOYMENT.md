# Tactical Education – VPS Deployment Tutorial

This guide covers deploying both the backend (Node.js + Express + Prisma + MySQL) and the frontend PWA (Vite + React + Tailwind) on a single Ubuntu 22.04 VPS, attaching domains, and enabling HTTPS.

<hr />

## 0. Prerequisites

| Requirement | Notes |
| --- | --- |
| VPS | Ubuntu 22.04 LTS (2 vCPU / 4 GB RAM recommended) |
| DNS access | Can create `A`/`AAAA` records for your domain/subdomain |
| Database | Managed MySQL 8.x or self-hosted on the VPS |
| Node.js | v20.x (install via `nvm` or Nodesource) |
| Git | Pull latest code |
| PM2 | `npm install -g pm2` |
| Nginx | `sudo apt install nginx` |
| Certbot | `sudo snap install --classic certbot` |

<hr />

## 1. Prepare the VPS

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential nginx mysql-client unzip
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 20
npm install -g pm2
```

```bash
sudo mkdir -p /var/www/tactical-education
sudo chown $USER:$USER /var/www/tactical-education
cd /var/www/tactical-education
git clone <repo-url> .
```

<hr />

## 2. Configure Environment Variables

### Backend (`backend/.env`)

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

```
PORT=5000
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DATABASE"
JWT_ACCESS_SECRET=change_me
JWT_REFRESH_SECRET=change_me_too
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://app.yourdomain.com
```

### Frontend (`frontend/.env`)

```
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_WHATSAPP_LINK=https://wa.me/62xxxxxxxxxxx
```

<hr />

## 3. Deploy the Backend API

```bash
cd /var/www/tactical-education/backend
npm install
npx prisma migrate deploy
npx prisma db seed        # optional demo data
npm run build
pm2 start dist/server.js --name tactical-api --env production
pm2 save
pm2 startup systemd
sudo env PATH=$PATH:/home/$USER/.nvm/versions/node/v20.*/bin pm2 startup systemd -u $USER --hp /home/$USER
```

Health check: `curl http://localhost:5000/api/v1/health`.

<hr />

## 4. Build & Serve the Frontend PWA

```bash
cd /var/www/tactical-education/frontend
npm install
npm run build
sudo mkdir -p /var/www/tactical-education/frontend_dist
sudo rsync -a dist/ /var/www/tactical-education/frontend_dist/
```

<hr />

## 5. Configure Nginx & Domain Linking

### DNS

- `api.yourdomain.com` → VPS IPv4
- `app.yourdomain.com` → VPS IPv4

### Nginx (backend)

`/etc/nginx/sites-available/tactical-api.conf`

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Nginx (frontend)

`/etc/nginx/sites-available/tactical-app.conf`

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    root /var/www/tactical-education/frontend_dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tactical-api.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/tactical-app.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

<hr />

## 6. Enable HTTPS with Certbot

```bash
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
sudo certbot renew --dry-run
```

<hr />

## 7. Post-Deployment Checklist

1. `https://api.yourdomain.com/api/v1/health`
2. `https://app.yourdomain.com` PWA loads & registers service worker
3. Register/login to verify JWT & refresh flow
4. `pm2 logs tactical-api` clean
5. Schedule MySQL backups
6. Add uptime monitoring

<hr />

## 8. Updating the Deployment

```bash
cd /var/www/tactical-education
git pull origin main

cd backend && npm install && npm run build && npx prisma migrate deploy && pm2 restart tactical-api
cd ../frontend && npm install && npm run build
sudo rsync -a dist/ /var/www/tactical-education/frontend_dist/
sudo systemctl reload nginx
```

Always re-run `npm run lint` and `npm run build` locally before deploying.

<hr />

## 9. Troubleshooting

| Issue | Fix |
| --- | --- |
| `502 Bad Gateway` | Ensure PM2 process is running; check `pm2 logs` |
| Migration failures | Verify DB credentials; run `npx prisma migrate resolve --applied <migration>` if needed |
| PWA cache stale | Clear browser cache or bump build; confirm `registerSW.js` served |
| Certbot errors | Wait for DNS propagation; ensure ports 80/443 are open |

This tutorial fulfills the VPS setup, domain linking, and HTTPS requirements for Tactical Education.
