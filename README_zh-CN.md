# LevelUp Life PWA

[English](./README.md) | 中文

LevelUp Life PWA 是 LevelUp Life 的 Web Push 版本。它保留标准 Web 版的 RPG 任务系统，并增加可安装 PWA、Service Worker、推送订阅 API 和服务端提醒调度器。

标准 Web 版仓库：[LevelUpLife](https://github.com/m2dumpling/LevelUpLife)

## 当前状态

- 包含标准 Web 版的非推送业务逻辑。
- 增加 VAPID、`public/sw.js`、推送订阅 API 和 `src/lib/push-scheduler.ts`。
- 可以和标准 Web 版并行部署在同一台 VPS。
- 推荐线上布局：
  - 标准 Web：`/opt/levelup-life`，PM2 `levelup-life`，端口 `3000`
  - PWA：`/opt/levelup-life-pwa`，PM2 `leveluplife-pwa`，端口 `3001`
- 最近的业务回归修复由 `npm run test:bugs` 覆盖，包括金币礼物只提示一次、任务奖励按任务拥有者计算、Boss 奖励只发一次、公会按终身 XP 排名、每日结算日期边界、推送相关 schema 兼容等。

## 功能

- Habit 和 Plan 任务，包含 XP、金币、HP、等级、连续打卡、成就、剧情、热力图、月视图。
- 商店、合成、背包、奖牌装备、宠物、村庄、天气、职业加成。
- PvP、每日抽奖、世界 Boss、公会、公会聊天、金币礼物。
- 金币礼物提示通过 `gift_log.seen_at` 在服务端记录，确保收礼人只弹一次。
- PWA 资源位于 `public/manifest.json`、`public/sw.js`、`public/icons/`。
- 服务端 Web Push 提醒，不依赖 Android 本地闹钟进程存活。

## 技术栈

- Next.js 16、React 19、TypeScript
- Tailwind CSS v4、shadcn/ui 风格组件、Framer Motion
- SQLite、Drizzle ORM、better-sqlite3
- JWT、bcryptjs
- Web Push（`web-push`）和 VAPID
- PM2 standalone 部署，适合配合 Cloudflare Tunnel

## 本地开发

```bash
npm install
cp .env.example .env
npm run db:push
npx tsx drizzle/seed.ts
npm run dev
```

打开 `http://localhost:3000`。

必须配置的 `.env`：

```bash
AUTH_PASSWORD=your-secret-password
JWT_SECRET=change-me-to-a-random-string-at-least-32-chars
DATABASE_PATH=./data/levelup.db
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@example.com
```

生成 VAPID 密钥：

```bash
npx web-push generate-vapid-keys
```

## 验证

```bash
npm run test:bugs
npm run build
```

`npm run test:bugs` 是重点业务回归测试。`npm run build` 验证生产构建。

## 和 Web 版并行部署

已有标准 Web 版时，推荐布局：

- PWA 路径：`/opt/levelup-life-pwa`
- PM2 应用名：`leveluplife-pwa`
- 端口：`3001`
- 数据库模式：和标准 Web 共用 `/opt/levelup-life/data/levelup.db`，或使用独立绝对路径。

如果 PWA 要给现有 Web 版的同一批用户和任务发提醒，使用共享数据库：

```bash
DATABASE_PATH=/opt/levelup-life/data/levelup.db
```

如果 PWA 要完全独立，使用：

```bash
DATABASE_PATH=/opt/levelup-life-pwa/data/levelup.db
```

生产环境不要在 PM2 standalone 下使用 `./data/levelup.db` 这种相对路径。它可能指到 `.next/standalone/data`，创建一个新的空库，导致 `SQLITE_ERROR: no such table: user`。

先安装 Node.js 22 和 PM2：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs git
npm install -g pm2
```

如果 VPS 已配置 GitHub SSH key，建议用 SSH 克隆：

```bash
cd /opt
git clone git@github.com:m2dumpling/LevelUpLife-PWA.git levelup-life-pwa
cd /opt/levelup-life-pwa
```

创建 `.env`：

```bash
cat > .env <<'EOF'
AUTH_PASSWORD=替换成登录密码
JWT_SECRET=替换成足够长的随机密钥
DATABASE_PATH=/opt/levelup-life/data/levelup.db
VAPID_PUBLIC_KEY=替换成VAPID公钥
VAPID_PRIVATE_KEY=替换成VAPID私钥
VAPID_SUBJECT=mailto:admin@example.com
EOF
chmod 600 .env
```

构建并初始化 schema：

```bash
npm ci
npm run db:push
npm run build
npx tsx drizzle/seed.ts
```

用 PM2 启动到 `3001`：

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

健康检查：

```bash
curl -I http://127.0.0.1:3001
```

未登录请求返回 `307` 并跳转到 `/login` 是正常的。

## 已安装 VPS 如何更新

已有 `/opt/levelup-life-pwa` 部署时：

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

如果 PWA 使用独立数据库，改为备份这个文件：

```bash
cp /opt/levelup-life-pwa/data/levelup.db /opt/levelup-life-pwa/data/levelup.db.bak-$(date +%Y%m%d%H%M%S)
```

如果本次更新改了 `drizzle/schema.ts`，在备份数据库后、重启前执行：

```bash
npm run db:push
```

仓库里的 `ecosystem.config.cjs` 和 `update.sh` 假设 PWA 安装在 `/opt/levelup-life-pwa`，PM2 应用名是 `leveluplife-pwa`，并且标准 Web 数据目录在 `/opt/levelup-life/data`：

```bash
cd /opt/levelup-life-pwa
./update.sh
```

## Web Push 说明

- 必须设置 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`，推送调度器才会真正运行。
- 调度器由 `src/instrumentation.ts` 在 Next.js 服务启动时加载。
- 当前启动日志类似：

```text
[PushScheduler] Web Push 定时调度器已启动（每 1 秒扫描）
```

查看日志：

```bash
pm2 logs leveluplife-pwa --lines 80 --nostream
```

iOS 需要 Safari 16.4+，并且必须把网站添加到主屏幕后才能接收 Web Push。Android Chrome/Edge 支持浏览器推送服务。

## Cloudflare Tunnel

如果标准 Web 已经使用 `localhost:3000`，给 PWA 增加一个新 public hostname：

```text
pwa.your-domain.com -> http://localhost:3001
```

标准 Web 可以继续保持：

```text
your-domain.com -> http://localhost:3000
```

## 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `curl -I` 返回 `307 location: /login` | 正常，未登录用户会跳转登录页。 |
| `SQLITE_ERROR: no such table: user` 或 `no such table: task` | PM2 指到了新的空数据库。改成绝对 `DATABASE_PATH`，再 `pm2 restart leveluplife-pwa --update-env`。 |
| Push scheduler 提示 VAPID 密钥缺失 | 设置 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`。 |
| 部署后出现 `Failed to find Server Action "x"` | 多数是浏览器或 PWA 还拿着旧构建资源。刷新、关闭旧标签页或清站点缓存。 |
| `pm2 logs` 一直不退出 | 这是 tail 日志的正常行为。按 `Ctrl+C`，或加 `--nostream`。 |
| 构建找不到 Tailwind 包 | 不要用 `npm ci --omit=dev`，生产构建需要 devDependencies。执行 `npm ci` 后再 `npm run build`。 |

## 项目结构

```text
drizzle/                  数据库 schema、迁移、种子脚本
public/manifest.json      PWA 清单
public/sw.js              接收 push 事件的 Service Worker
public/icons/             PWA 图标
src/app/                  Next.js 页面和 API
src/app/api/push/         订阅、取消订阅、VAPID key API
src/components/           主要 UI 组件，包括 PushSubscribe
src/instrumentation.ts    服务启动时加载推送调度器
src/lib/push-scheduler.ts 服务端提醒扫描和 Web Push 发送
tests/                    业务回归测试
ecosystem.config.cjs      PM2 配置：/opt/levelup-life-pwa，端口 3001
update.sh                 PWA VPS 更新脚本
```
