/**
 * Web Push 定时调度器
 *
 * VPS 启动后每 1 秒扫描一次好友消息；任务提醒按北京时间分钟去重。
 */
import { db, schema } from "@/lib/db";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { getTodayLocal } from "@/lib/date-utils";
import webpush from "web-push";

let running = false;
let lastTaskScanMinute = "";
let lastFriendChatId = 0;
let pushedTaskKeyDate = "";
const pushedTaskKeys = new Set<string>();

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
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode === 410 || error.statusCode === 404) {
      db.delete(schema.pushSubscription)
        .where(eq(schema.pushSubscription.endpoint, sub.endpoint))
        .run();
      console.log("[PushScheduler] 删除过期订阅:", sub.endpoint.slice(0, 50));
    } else {
      console.warn("[PushScheduler] 推送失败:", error.statusCode, sub.endpoint?.slice(0, 50));
    }
  }
}

export function getDueReminderTasksForMinute(currentMinute: string) {
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

  const today = getTodayLocal();
  return tasks.filter((task) => {
    if (task.mode !== "habit") return true;
    const completedToday = db
      .select({ id: schema.habitLog.id })
      .from(schema.habitLog)
      .where(
        and(
          eq(schema.habitLog.userId, task.userId),
          eq(schema.habitLog.taskId, task.id),
          eq(schema.habitLog.completedAt, today),
        )
      )
      .get();
    return !completedToday;
  });
}

async function scanTaskReminders(currentMinute: string) {
  if (currentMinute === lastTaskScanMinute) return;
  lastTaskScanMinute = currentMinute;

  const today = getTodayLocal();
  if (today !== pushedTaskKeyDate) {
    pushedTaskKeyDate = today;
    pushedTaskKeys.clear();
  }

  const tasks = getDueReminderTasksForMinute(currentMinute);
  if (tasks.length === 0) return;

  console.log(`[PushScheduler] ${currentMinute} - ${tasks.length} 个任务到提醒时间`);

  for (const task of tasks) {
    const pushKey = `${today}:${currentMinute}:${task.id}`;
    if (pushedTaskKeys.has(pushKey)) continue;
    pushedTaskKeys.add(pushKey);

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
}

async function scanFriendMessages() {
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
}

async function scanAndPush() {
  const keys = getVapidKeys();
  if (!keys) return;

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  try {
    await scanTaskReminders(getBeijingTimeNow());
    await scanFriendMessages();
  } catch (e) {
    console.error("[PushScheduler] 扫描失败:", e);
  }
}

export function startPushScheduler() {
  if (running) return;

  const keys = getVapidKeys();
  if (!keys) return;

  running = true;
  console.log("[PushScheduler] Web Push 定时调度器已启动（每 1 秒扫描）");

  scanAndPush();
  setInterval(scanAndPush, 1_000);
}
