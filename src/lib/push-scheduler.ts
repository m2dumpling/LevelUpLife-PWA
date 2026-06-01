/**
 * Web Push 定时调度器
 *
 * VPS 启动后每 10 秒扫描一次：检查是否有任务到了提醒时间，
 * 有则通过 Web Push 向该用户的所有订阅设备发送推送通知。
 *
 * 替代了原来依赖手机端 AlarmManager 的不可靠方案。
 */
import { db, schema } from "@/lib/db";
import { and, eq, ne, gt, desc } from "drizzle-orm";
import webpush from "web-push";

let running = false;
let lastMinute = "";
let lastFriendChatId = 0;

/** 获取当前北京时间 HH:MM，不依赖 VPS 系统时区 */
function getBeijingTimeNow(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hours = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minutes = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hours}:${minutes}`;
}

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@119777.xyz";

  if (!publicKey || !privateKey) {
    console.warn("[PushScheduler] VAPID 密钥未设置，推送调度器不会运行");
    return null;
  }

  return { publicKey, privateKey, subject };
}

async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: object
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
  } catch (e: any) {
    // 410 Gone = 订阅已过期/取消, 404 = 端点无效, 删除过期订阅
    if (e.statusCode === 410 || e.statusCode === 404) {
      db.delete(schema.pushSubscription)
        .where(eq(schema.pushSubscription.endpoint, sub.endpoint))
        .run();
      console.log("[PushScheduler] 删除过期订阅:", sub.endpoint.slice(0, 50));
    } else {
      console.warn("[PushScheduler] 推送失败:", e.statusCode, sub.endpoint?.slice(0, 50));
    }
  }
}

async function scanAndPush() {
  const keys = getVapidKeys();
  if (!keys) return;

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  const currentMinute = getBeijingTimeNow();

  // 避免同 1 分钟内重复扫描
  if (currentMinute === lastMinute) return;
  lastMinute = currentMinute;

  try {
    // 查询所有设置了 reminderTime（当前分钟）且未完成的任务
    const tasks = db
      .select({
        id: schema.task.id,
        userId: schema.task.userId,
        title: schema.task.title,
        difficulty: schema.task.difficulty,
        mode: schema.task.mode,
      })
      .from(schema.task)
      .where(
        and(
          eq(schema.task.reminderTime, currentMinute),
          eq(schema.task.completed, false),
          ne(schema.task.status, "completed"),
          ne(schema.task.status, "failed"),
        )
      )
      .all();

    if (tasks.length === 0) return;

    console.log(`[PushScheduler] ${currentMinute} — ${tasks.length} 个任务到提醒时间`);

    for (const task of tasks) {
      const subs = db
        .select()
        .from(schema.pushSubscription)
        .where(eq(schema.pushSubscription.userId, task.userId))
        .all();

      if (subs.length === 0) continue;

      const difficultyLabel: Record<string, string> = {
        trivial: "琐碎",
        easy: "简单",
        medium: "中等",
        hard: "困难",
        heroic: "史诗",
      };
      const diff = difficultyLabel[task.difficulty] || task.difficulty;

      const payload = {
        title: `⏰ ${task.title}`,
        body: `该去完成 "${task.title}" 了！难度：${diff}`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-72.png",
        vibrate: [200, 100, 200],
        data: { url: "/", taskId: task.id },
        tag: `task-reminder-${task.id}`,
      };

      for (const sub of subs) {
        await sendPush(sub, payload);
      }
    }
    // ── 好友私聊消息推送 ──
    if (lastFriendChatId === 0) {
      const latest = db.select().from(schema.friendChat).orderBy(desc(schema.friendChat.id)).limit(1).get();
      lastFriendChatId = latest?.id ?? 0;
    }

    const newMsgs = db.select().from(schema.friendChat).where(gt(schema.friendChat.id, lastFriendChatId)).all();
    for (const msg of newMsgs) {
      if (msg.id > lastFriendChatId) lastFriendChatId = msg.id;
      const subs = db.select().from(schema.pushSubscription).where(eq(schema.pushSubscription.userId, msg.friendId)).all();
      if (subs.length === 0) continue;

      const sender = db.select({ username: schema.user.username }).from(schema.user).where(eq(schema.user.id, msg.userId)).get();
      const payload = {
        title: `💬 ${sender?.username || "好友"} 发来消息`,
        body: msg.message.slice(0, 80),
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-72.png",
        vibrate: [200, 100, 200],
        data: { url: `/pm?friend=${msg.userId}` },
        tag: `friend-msg-${msg.id}`,
      };
      for (const sub of subs) {
        await sendPush(sub, payload);
      }
    }
  } catch (e) {
    console.error("[PushScheduler] 扫描失败:", e);
  }
}

export function startPushScheduler() {
  if (running) return;
  running = true;

  const keys = getVapidKeys();
  if (!keys) return;

  console.log("[PushScheduler] Web Push 定时调度器已启动（每 10 秒扫描）");

  // 立即执行一次，之后每 10 秒执行
  scanAndPush();
  setInterval(scanAndPush, 10_000);
}
