# LevelUp Life PWA

English | [中文](./README_zh-CN.md)

LevelUp Life PWA is the Web Push version of LevelUp Life. It keeps the same RPG task system as the standard web app and adds an installable manifest, service worker, push subscription APIs, and a server-side reminder scheduler.

Standard web version: [LevelUpLife](https://github.com/m2dumpling/LevelUpLife)

## Current Status

- Includes all non-push business logic from the standard web version.
- Adds Web Push through VAPID keys, `public/sw.js`, push subscription APIs, and `src/lib/push-scheduler.ts`.
- Can run beside the standard web app on the same VPS.
- Recommended live layout:
  - Standard web app: `/opt/levelup-life`, PM2 `levelup-life`, port `3000`
  - PWA app: `/opt/levelup-life-pwa`, PM2 `leveluplife-pwa`, port `3001`
- Recent regression fixes are covered by `npm run test:bugs`, including one-time gift prompts, task-owner reward isolation, boss reward distribution, guild lifetime XP ranking, daily settlement date handling, and push-related schema compatibility.

## Features

- Habit and plan tasks with XP, gold, HP, levels, streaks, achievements, story, heatmap, and monthly view.
- Shop, crafting, backpack, medal equipment, pets, village, weather, and class bonuses.
- PvP, daily lottery, world boss, guilds, guild chat, and gold gifts.
- Gift notifications are server-side one-time prompts through `gift_log.seen_at`.
- Installable PWA assets in `public/manifest.json`, `public/sw.js`, and `public/icons/`.
- Server-side Web Push reminders, so reminders do not depend on a local Android alarm process.

## Tech Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS v4, shadcn/ui style components, Framer Motion
- SQLite, Drizzle ORM, better-sqlite3
- JWT, bcryptjs
- Web Push (`web-push`) with VAPID keys
- PM2 standalone deployment, Cloudflare Tunnel friendly

## Local Development

```bash
npm install
cp .env.example .env
npm run db:push
npx tsx drizzle/seed.ts
npm run dev
```

Open `http://localhost:3000`.

Required `.env` values:

```bash
AUTH_PASSWORD=your-secret-password
JWT_SECRET=change-me-to-a-random-string-at-least-32-chars
DATABASE_PATH=./data/levelup.db
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@example.com
```

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

## Verification

```bash
npm run test:bugs
npm run build
```

`npm run test:bugs` is the focused business-regression suite. `npm run build` verifies the production Next.js build.

## Production Install Beside The Web App

This is the recommended layout when the VPS already has the standard web version installed:

- PWA path: `/opt/levelup-life-pwa`
- PM2 app: `leveluplife-pwa`
- Port: `3001`
- Database mode: either share `/opt/levelup-life/data/levelup.db` with the standard web app, or use an independent absolute path.

If the PWA should send reminders for the same users and tasks as the existing web app, use the shared database:

```bash
DATABASE_PATH=/opt/levelup-life/data/levelup.db
```

If the PWA should be independent, use:

```bash
DATABASE_PATH=/opt/levelup-life-pwa/data/levelup.db
```

Do not use a relative production database path such as `./data/levelup.db` under PM2 standalone. It can point at `.next/standalone/data` and create an empty database, which causes `SQLITE_ERROR: no such table: user`.

Install Node.js 22 and PM2 first:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs git
npm install -g pm2
```

Clone with SSH if the VPS has deploy keys configured:

```bash
cd /opt
git clone git@github.com:m2dumpling/LevelUpLife-PWA.git levelup-life-pwa
cd /opt/levelup-life-pwa
```

Create `.env`:

```bash
cat > .env <<'EOF'
AUTH_PASSWORD=replace-with-login-password
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_PATH=/opt/levelup-life/data/levelup.db
VAPID_PUBLIC_KEY=replace-with-vapid-public-key
VAPID_PRIVATE_KEY=replace-with-vapid-private-key
VAPID_SUBJECT=mailto:admin@example.com
EOF
chmod 600 .env
```

Build and initialize schema:

```bash
npm ci
npm run db:push
npm run build
npx tsx drizzle/seed.ts
```

Start PM2 on port `3001`:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Health check:

```bash
curl -I http://127.0.0.1:3001
```

`307` redirecting to `/login` is normal for an unauthenticated request.

## Updating An Installed VPS

For the existing `/opt/levelup-life-pwa` deployment:

```bash
cd /opt/levelup-life-pwa
git fetch origin
git status
cp /opt/levelup-life/data/levelup.db /opt/levelup-life/data/levelup.db.bak-$(date +%Y%m%d%H%M%S)
git pull --ff-only origin main
npm ci --no-audit --no-fund
npm run build
pm2 restart leveluplife-pwa --update-env
curl -I http://127.0.0.1:3001
```

If this PWA uses an independent database, back up that file instead:

```bash
cp /opt/levelup-life-pwa/data/levelup.db /opt/levelup-life-pwa/data/levelup.db.bak-$(date +%Y%m%d%H%M%S)
```

If `drizzle/schema.ts` changed, run this after the database backup and before restart:

```bash
npm run db:push
```

The included `ecosystem.config.cjs` and `update.sh` assume the PWA is installed at `/opt/levelup-life-pwa`, the PM2 app is named `leveluplife-pwa`, and the standard web database is available at `/opt/levelup-life/data`:

```bash
cd /opt/levelup-life-pwa
./update.sh
```

## Web Push Notes

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` must be set before push scheduling can run.
- The scheduler starts from `src/instrumentation.ts` when the Next.js server starts.
- Current scheduler log line:

```text
[PushScheduler] Web Push 定时调度器已启动（每 1 秒扫描）
```

Check logs:

```bash
pm2 logs leveluplife-pwa --lines 80 --nostream
```

On iOS, Web Push requires Safari 16.4+ and the site must be added to the Home Screen. Chrome/Edge on Android support Web Push through the browser push service.

## Cloudflare Tunnel

If the standard app already uses `localhost:3000`, add another public hostname for the PWA:

```text
pwa.your-domain.com -> http://localhost:3001
```

The standard web app can keep:

```text
your-domain.com -> http://localhost:3000
```

## Troubleshooting

| Symptom | Meaning / Fix |
| --- | --- |
| `curl -I` returns `307 location: /login` | Healthy. The app redirects anonymous users to login. |
| `SQLITE_ERROR: no such table: user` or `no such table: task` | PM2 is pointing at a new/empty database. Use an absolute `DATABASE_PATH`, then `pm2 restart leveluplife-pwa --update-env`. |
| Push scheduler says VAPID keys are missing | Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in `.env` or PM2 env. |
| `Failed to find Server Action "x"` after deploy | Usually stale browser/PWA chunks from an older build. Refresh, close old tabs, or clear site data. |
| `pm2 logs` appears stuck | It is tailing logs by design. Press `Ctrl+C`, or use `--nostream`. |
| Build cannot find Tailwind packages | Do not install with `--omit=dev`; production build needs dev dependencies. Run `npm ci` then `npm run build`. |

## Project Layout

```text
drizzle/                  Database schema, migrations, seed script
public/manifest.json      PWA manifest
public/sw.js              Service worker for push events
public/icons/             PWA icons
src/app/                  Next.js pages and API routes
src/app/api/push/         Subscribe, unsubscribe, and VAPID key APIs
src/components/           Main UI components, including PushSubscribe
src/instrumentation.ts    Starts the push scheduler on server boot
src/lib/push-scheduler.ts Server-side reminder scanning and Web Push sending
tests/                    Business regression tests
ecosystem.config.cjs      PM2 config for /opt/levelup-life-pwa on port 3001
update.sh                 VPS update helper for the PWA deployment
```
