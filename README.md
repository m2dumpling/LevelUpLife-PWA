# LevelUp Life PWA — Push Notifications That Actually Work

> ⚠️ 这是 LevelUp Life 的 **PWA 增强版**，在原版基础上添加了 Web Push 通知系统。
> 原版仓库：[LevelUpLife](https://github.com/m2dumpling/LevelUpLife) · 此版本可独立部署，互不冲突。


---

## 🎮 How to Play

You're a hero. Every habit you build, every deadline you hit — that's XP. Level up. Buy gear. Fight the dark lord of procrastination.

### 📋 Two Types of Quests

| | Habit 🔥 | Plan 📋 |
|------|---------|------|
| **What** | Your daily grind: exercise, read, meditate, drink water... | One-shot mission: "Ship the feature by Friday" |
| **When** | Every day / week / month — pick your weekdays | A specific date you choose |
| **Win** | Check in each cycle → XP + Gold stack up | Complete on the due date → big payout |

Tap **+ Create** → set difficulty → preview your quest → confirm. Tap the circle ○ to check in and watch XP fly up.

### 📈 Level Up or Die Trying

> Trivial 5XP · Easy 10XP · Medium 20XP · Hard 40XP · Heroic 80XP

Formula: `xpToNext = 100 × level^1.5`. Level 1→2 is 100 XP. Level 50→51 is 35,000+. Things get real.

### 💀 HP — Your Accountability Bar

You start with **100 HP ❤️**. Every daily Habit you skip costs **5 HP**. Hit **zero** and you're *weakened* — **-10% XP** on everything until you recover.

Log in each day to heal **+20 HP**. The game punishes neglect but rewards consistency.

| HP | Status |
|----|--------|
| > 0 | Healthy — full XP |
| 0 💀 | Weakened — **-10% XP penalty** |

### ⚒️ Shop → Craft → Equip → Stack

Gold isn't just for show. Spend it:

```
Shop 🏪 → buy ores → Craft ⚒️ → forge medals → Equip 🎒 → XP multiplier grows
```

| Ore | Price | Medal | Rarity | XP Bonus |
|-----|-------|-------|--------|----------|
| 🪨 Copper | 10G | 🥉 Copper Medal | Common | +2% |
| ⛏️ Iron | 30G | 🥈 Iron Medal | Uncommon | +5% |
| 🥇 Gold | 100G | 🥇 Gold Medal | Rare | +10% |
| 💠 Mithril | 300G | 💠 Mithril Medal | Epic | +15% |
| 💎 Adamantite | 1000G | 💎 Adamantite Medal | Legendary | +25% |

Medals **multiply**. Five Copper Medals = 1.02⁵ ≈ **+10.4% XP** on every task. Stack wisely.

### 🏆 Achievements & Story
- **18 hidden & visible achievements** ⚔️ — from "First Quest" to "Quest King"
- **6-chapter story** 📖 with NPCs, dialog, and rewards
- **GitHub-style heatmap** 🟩 tracks your habit density
- **Monthly view** 🗓️ shows the next 30 days at a glance

### ⚔️ PvP Arena — Battle Other Heroes
Challenge other players in real-time duels. Winner takes the pot (minus 2G tax).

| Mode | How It Works |
|------|-------------|
| ✊ Rock-Paper-Scissors | Both players pick a move → reveal → winner announced with animated showdown |
| 🎲 Dice Duel | Each player rolls a D20 — highest roll wins. Ties trigger re-rolls up to 3x |
| ⏱ Speed Math | Race to solve a math problem. Correct answer + speed = victory |

- Create a duel with 10–500G bets
- Join waiting duels from other players
- Real-time polling shows opponent's moves
- Daily limit: 10 PvP matches
- Entry requirement: complete at least 1 task today

### 🎰 Daily Lottery
Finish 3+ habits today → spin the wheel for free! Win medals, gold, rare items.

### 🐲 World Boss
Every habit completion deals damage to the shared World Boss. Defeat it together for server-wide rewards.

### 🏰 Guild Hall — Fight Together
- Create or join a guild with a 6-digit invite code
- **Full-screen Discord-style chat** `/chat` with colored avatars, message grouping, and Beijing-time timestamps
- Guild HP bar — damaged when members miss tasks
- **Guild leaderboard** ranks guilds by total XP
- Leader can kick members; members can leave

### 🐾 Pet System
Hatch pet eggs from task rewards. Each pet gives passive buffs (XP bonus, HP recovery, extra gold).

### 🏡 Village
Build your village! Each completed task contributes resources. Unlock buildings for permanent bonuses.

### 🌦 Weather System
Dynamic weather affects task rewards — sunny days boost XP, storms challenge you. Check the weather badge on your dashboard.

### 🎭 Class System
Your task history determines your class (Warrior, Mage, Rogue, etc.) with unique bonuses.

### 🔒 Multi-User + Admin Panel
- **Register/Login** — anyone can create an account (username + password)
- **Admin dashboard** at `/admin` — user stats, registration trends, country distribution
- Content audit flags suspicious task titles
- Ban/unban users, export data, download DB backup
- Only the seed-created `admin` account can access — no privilege escalation possible

---

## 🔔 Web Push — VPS 驱动的可靠通知

**为什么原版通知不可靠？** 原版 Android App 使用本地 `AlarmManager` 调度——手机关机/重启 → 闹钟全丢；国产 ROM 杀进程 → 通知报废。

**PWA 版方案：通知调度搬上 VPS，手机只管接收。**

```
VPS (一直在线)                浏览器 Push Service              手机
─────────────               ──────────────────             ──────
每 30 秒扫描提醒时间  ──Web Push──▶  FCM / APNs  ──系统通知──▶  弹出提醒
                                                         点击 → 打开 App
```

| | 原版 App (本地通知) | PWA 版 (Web Push) |
|---|---|---|
| 手机关机/重启 | ❌ 通知丢失 | ✅ VPS 照常推送 |
| App 被杀进程 | ❌ 无声 | ✅ 系统级通道 |
| 小米/OPPO/vivo | ❌ 需手动加白名单 | ✅ FCM 不受影响 |
| 更新推送 | 需重新打包 APK | ✅ 改 Web 即时生效 |

**如何使用：** 登录后在页面顶部点击 **"🔔 开启通知"** → 浏览器请求权限 → 允许 → 到点自动推送。

> iOS 限制：Safari 16.4+ 且需将网页"添加到主屏幕"。Chrome Android 完全支持。

---

## 📱 Also on Android

Want notifications that actually work? Get the **[LevelUp Life Android App →](https://github.com/m2dumpling/LevelUpLife-App)** — same game, native alarms, works offline.

---

## 🛠 Tech Stack

Next.js 16 · TypeScript · Tailwind CSS v4 · shadcn/ui · SQLite · Drizzle ORM · JWT + bcrypt · Framer Motion · pm2 · Cloudflare Tunnel

---

## 🖥 Local Dev

```bash
npm install
cp .env.example .env          # Set AUTH_PASSWORD + JWT_SECRET
npx drizzle-kit push --force  # Sync SQLite schema
npm run dev
npx tsx drizzle/seed.ts       # First run only
```

Open `http://localhost:3000` → log in with your `.env` password.

---

## ☁️ VPS Deployment（与原项目并行运行）

在原 VPS 上新开端口部署，不影响正在运行的原版。

### 0. 前提：生成 VAPID 密钥

```bash
npx web-push generate-vapid-keys
# 记下 Public Key 和 Private Key
```

### 1. Clone（新目录，不与原项目冲突）

```bash
cd /opt
git clone https://github.com/m2dumpling/LevelUpLife-PWA.git levelup-life-pwa
cd levelup-life-pwa
```

### 2. Secrets

```bash
cat > .env << EOF
AUTH_PASSWORD=你的密码
JWT_SECRET=你的JWT密钥
DATABASE_PATH=./data/levelup.db
VAPID_PUBLIC_KEY=上面生成的Public_Key
VAPID_PRIVATE_KEY=上面生成的Private_Key
VAPID_SUBJECT=mailto:admin@119777.xyz
EOF
chmod 600 .env
```

### 3. Build

```bash
npm ci
npx drizzle-kit push --force    # 新建 push_subscription 表
npm run build
npx tsx drizzle/seed.ts         # 首次运行
```

### 4. Launch（端口 3001，不与原 3000 冲突）

```bash
pm2 start npm --name leveluplife-pwa -- start -- -p 3001
pm2 save
curl -I http://127.0.0.1:3001   # → 307 = working
```

### 5. Cloudflare Tunnel 加域名

原 Tunnel 已配好 `up.119777.xyz` → `localhost:3000`。
PWA 版再加一条：`pwa.119777.xyz` → `localhost:3001`

```bash
# 如果用 cloudflared tunnel config.yaml 方式：
# 编辑配置文件，在 ingress 里加一条

# 或者用 Cloudflare Dashboard：
# Zero Trust → Networks → Tunnels → 你的 Tunnel → 配置
# Public Hostname: pwa   Domain: 119777.xyz   Service: http://localhost:3001
```

### 6. 验证 Web Push 正常工作

```bash
# VPS 日志里应该看到：
pm2 logs leveluplife-pwa | grep PushScheduler
# [PushScheduler] Web Push 定时调度器已启动（每 30 秒扫描）
```

---

## 🔄 Updating

```bash
cd /opt/levelup-life-pwa
git pull origin main
npm ci                            # run when package-lock changed
npm run build                     # ~20s
npx drizzle-kit push --force      # required when schema changes
pm2 reload leveluplife-pwa
```

---

## 🩹 Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build: `Cannot find module @tailwindcss/postcss` | `npm ci --omit=dev` kills dev deps. Rerun `npm ci && npm run build` |
| Seed: `AUTH_PASSWORD 未设置` | Pull latest — seed script now auto-loads `.env` |
| Browser 404 but `curl localhost` works | Cloudflare Tunnel Public Hostname not pointing to `localhost:3000` |
| pm2: `next start` warning | Pull latest `ecosystem.config.cjs` (uses `server.js` now) |
| Blank page / no data | You skipped the seed step: `npx tsx drizzle/seed.ts` |
| `drizzle-kit push --forc` fails | It's `--force`, not `--forc` |

---

## 📁 Project Structure

```
├── drizzle/                    # DB schema + seed
├── src/
│   ├── app/
│   │   ├── api/                # REST: tasks, auth, shop, craft, inventory, logs
│   │   └── login/              # Auth page
│   ├── components/
│   │   ├── TaskList.tsx        # Task tabs + create/edit/search/filter
│   │   ├── TaskCard.tsx        # Task card (check in / edit / undo / delete)
│   │   ├── StatDashboard.tsx   # Stats panel (Lv, XP, Gold, HP, Streak)
│   │   ├── Heatmap.tsx         # Contribution graph (week/month/year)
│   │   ├── MonthlyView.tsx     # 30-day task overview
│   │   ├── Timeline.tsx        # Daily activity log
│   │   ├── ShopDialog.tsx      # Ore shop
│   │   ├── BackpackDialog.tsx  # Inventory + medal equip
│   │   └── LevelUpModal.tsx    # Level-up celebration
│   ├── hooks/                  # useTasks, useStats
│   └── lib/                    # auth, db, xp-calc, shop-data, date-utils
├── public/
│   ├── sw.js                   # Service Worker（接收推送 → 弹出通知）
│   ├── manifest.json           # PWA 清单（添加到主屏幕）
│   └── icons/                  # App 图标（10 种尺寸）
├── src/
│   ├── instrumentation.ts      # Next.js 启动钩子（加载推送调度器）
│   ├── lib/
│   │   └── push-scheduler.ts   # 推送调度器（每 30 秒扫描提醒）
│   ├── app/api/push/           # subscribe / unsubscribe / vapid-key
│   └── components/
│       └── PushSubscribe.tsx   # 开启通知按钮
├── ecosystem.config.cjs        # pm2 config（原版用，PWA 用 pm2 start npm）
└── .env.example
```
