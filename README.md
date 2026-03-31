# TTG Tool (totheglory.im Crawler UI)

A small web app that crawls your `totheglory.im` browse pages, applies local filters, and helps you track what you’ve already browsed.

- Frontend: React + Vite
- Backend: Express + Puppeteer
- State (on VM): files under `api/.data/` (encrypted config + browse history)

## Contents

- [User Guide](#user-guide)
  - [Setup](#setup)
  - [Scan New](#scan-new)
  - [Results Navigation](#results-navigation)
  - [Browse Tracking (Seen)](#browse-tracking-seen)
  - [Filters (IMDb/Seed OR Conditions)](#filters-imdbseed-or-conditions)
  - [Debug UI](#debug-ui)
- [Deployment Guide (VM)](#deployment-guide-vm)
  - [Ports and Persistence](#ports-and-persistence)
  - [Install Dependencies](#install-dependencies)
  - [Build and Run](#build-and-run)
  - [Run as a Service (systemd)](#run-as-a-service-systemd)
- [Run with PM2](#run-with-pm2)
  - [Reverse Proxy (optional)](#reverse-proxy-optional)
  - [Troubleshooting Login](#troubleshooting-login)

---

## User Guide

### Setup

1. Start the app (dev or deployed).
2. Open **Settings**.
3. Configure:
   - **Credentials**: TTG username/password.
   - If your account uses a security question, also set **Security Question ID** (`1`–`7`) and **Security Answer**.
   - If TTG blocks automated logins, you can paste a browser session’s **Cookie Header** to use cookie-based auth.
4. Click **Save Settings**.

### Scan New

On **Dashboard**, click **Scan New**.

- This runs a scan and applies your filters.
- Results show in the table.

### Results Navigation

- Use `Prev` / `Next` to crawl TTG’s adjacent pages.
- Use the `0..10` quick buttons to jump directly:
  - `0` = TTG “newest” (no `page=` query parameter)
  - `1..N` = TTG `page=N`

### Browse Tracking (Seen)

The app tracks which ranges of content you’ve already browsed and renders those rows in a lighter “seen” style.

- Tracking is written when you navigate away from the current Results page.
- **Clear Tracking Log** (Settings) resets browse history.
- “置顶” pinned rows are excluded from tracking windows so they don’t mark many pages as seen.

### Filters (IMDb/Seed OR Conditions)

In Settings → Filters, `IMDb/Seed conditions (OR)` lets you define multiple AND-conditions combined with OR.

Example:

- `cond#1`: IMDb ≥ 6 AND Seed ≥ 10
- `cond#2`: IMDb ≥ 5 AND Seed ≥ 30
- `cond#3`: IMDb ≥ 7 AND Seed ≥ 1

If any condition matches, the item passes this group.

### Debug UI

Settings → **Debug UI** enables additional columns:

- `Seen`: `Y`/`N`
- `Matched`: shows which OR-condition matched (e.g. `cond#2(imdb>=5,seed>=30)`)

---

## Deployment Guide (VM)

Target: a Linux VM (e.g. GCE VM running Ubuntu 22.04).

### Ports and Persistence

- Backend API listens on `PORT` (default `3001`).
- Frontend is a static build (served by Nginx or any static server).

#### Choosing the External UI Port

The "external UI port" is the port your browser connects to.

- **Dev (Vite)**: choose it with Vite flags:

```bash
cd ttg-tool
npm run dev -- --host 0.0.0.0 --port 8080
```

- **Production (static build)**: you choose it in your static server:
  - With a simple CLI server:

```bash
cd ttg-tool
npm run build
npx serve -s dist -l 8080
```

  - With Nginx: set `listen 8080;` (or `80/443`) in your server block.

The backend port is independent. You can keep API on `3001` and expose UI on `80/443` (recommended).

If you serve the UI on a different port (e.g. `8080`) without a reverse proxy, `/api/...` requests will hit the UI server and return HTML. In that case either:

- Use Nginx to proxy `/api/` to the API service, or
- Run the API on `:3001` and let the UI call the API directly.

If the UI is served over **HTTPS**, the API must also be reachable over **HTTPS** (or via same-origin reverse proxy). Browsers block `https://...` pages from calling `http://...` APIs (mixed content).

For direct-calling, you can also build with an explicit API base:

```bash
VITE_API_BASE_URL=http://YOUR_VM_HOSTNAME_OR_IP:3001 npm run build
```

Or store it in the browser (runtime override): set `localStorage.ttg_api_base_url` to your API base URL.
- Persistent data:
  - `api/.data/ttg-config.enc.json` (encrypted config)
  - `api/.data/ttg-passphrase.txt` (generated passphrase if `TTG_CONFIG_PASSPHRASE` is not set)
  - `api/.data/ttg-browse-history.json`

Recommended for VMs:

- Set `TTG_CONFIG_PASSPHRASE` to a stable secret, and keep the VM disk persistent.

### Install Dependencies

Install Node.js (recommended: Node 20 LTS).

Puppeteer requires a set of system libraries on many minimal Linux images.

On Ubuntu, the following generally works (adjust if your distro differs):

```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates curl git \
  libnss3 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  libpangocairo-1.0-0 libpango-1.0-0 libgtk-3-0
```

### Build and Run

Clone the repo on the VM and run:

```bash
cd ttg-tool
npm ci
npm run build
```

Start the backend:

```bash
export NODE_ENV=production
export PORT=3001
export TTG_CONFIG_PASSPHRASE='your-long-random-secret'
cd ttg-tool
npm run server:start
```

Serve the frontend build output from `ttg-tool/dist` using Nginx (recommended) or any static server.

### Run as a Service (systemd)

Example `systemd` unit (adjust paths/user):

`/etc/systemd/system/ttg-tool.service`

```ini
[Unit]
Description=TTG Tool API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/ttg-tool
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=TTG_CONFIG_PASSPHRASE=your-long-random-secret
ExecStart=/usr/bin/npm run server:start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**How the port is set in systemd**

- The API listens on the value of the `PORT` environment variable.
- In `systemd`, you set it with `Environment=PORT=3001` inside the unit file (as above), or by using an `EnvironmentFile=`.

**How the Web UI port is set in systemd**

This project’s Web UI is a static build (`ttg-tool/dist`). It does **not** read `PORT`. The UI port is chosen by the **static server** you run:

- If you use **Nginx**, set the port with `listen <port>;` in the Nginx site config (recommended).
- If you run a simple static server like `serve`, set the port via its CLI flag (example below).

Example `systemd` service to serve the UI on port `8080` using `serve`:

`/etc/systemd/system/ttg-tool-ui.service`

```ini
[Unit]
Description=TTG Tool UI (static)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/ttg-tool
ExecStart=/usr/bin/npx serve -s dist -l 8080
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

If you instead want UI on `80/443`, use Nginx (and optionally proxy `/api/` to the API service on `127.0.0.1:3001`).

### Quick API Health Check

On the VM:

```bash
curl -sS http://127.0.0.1:3001/api/health
```

If that fails:

- Check the API service status: `systemctl status ttg-tool` and `journalctl -u ttg-tool -n 200 --no-pager`
- Check if anything is listening: `ss -ltnp | grep 3001`

### Run with PM2

PM2 can manage both:

- the **API** process on `PORT` (default `3001`), and
- a **static UI** server (example uses `serve` on `8080`).

Prereqs:

```bash
cd ttg-tool
npm ci
npm run build
npm i -g pm2
```

If you see `ecosystem.config.js is not found`, it usually means you ran `pm2 start ecosystem.config.js` from the wrong directory or the file doesn’t exist.

This repo includes an example config: `ecosystem.config.cjs`.

Start both processes via the ecosystem file:

```bash
cd ttg-tool
pm2 start ecosystem.config.cjs
```

Start the API (port `3001`):

```bash
PORT=3001 NODE_ENV=production TTG_CONFIG_PASSPHRASE='your-long-random-secret' \
  pm2 start "npm run server:start" --name ttg-api
```

Start the UI (port `8080`):

```bash
pm2 start "npx serve -s dist -l 8080" --name ttg-ui
```

Check:

```bash
pm2 status
pm2 logs ttg-api
curl -sS http://127.0.0.1:3001/api/health
```

Persist across reboots:

```bash
pm2 save
pm2 startup
```

If your UI is on a different origin/port than the API, prefer using Nginx to proxy `/api/` to `127.0.0.1:3001`.

Example using an env file:

`/etc/default/ttg-tool`

```bash
PORT=3001
TTG_CONFIG_PASSPHRASE=your-long-random-secret
```

Then in the unit:

```ini
EnvironmentFile=/etc/default/ttg-tool
```

Enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ttg-tool
sudo journalctl -u ttg-tool -f
```

### Reverse Proxy (optional)

Recommended setup:

- Nginx serves `ttg-tool/dist`.
- Nginx proxies `/api/` to `http://127.0.0.1:3001/api/`.

### Troubleshooting Login

If scans always fail “Not logged in”:

- Confirm Settings has correct **username/password**.
- If TTG requires security question: set **Security Question ID** (`1`–`7`) + **Security Answer**.
- If TTG blocks headless logins, use **Cookie Header**:
  - In a logged-in browser session, copy the request header value `Cookie: ...` from DevTools → Network.
  - Paste it into Settings → Credentials → Cookie Header.
  - Save Settings and scan again.

---

## Security Notes

- Do not commit `api/.data/` (it’s ignored via `.gitignore`).
- Treat `TTG_CONFIG_PASSPHRASE` and Cookie Header as secrets.
