/**
 * POST /api/push/subscribe
 * 接收浏览器推送订阅并存入数据库
 *
 * 安全：
 * - JWT 鉴权（middleware 层）
 * - 已存在的 endpoint 只能被原用户更新（防止劫持）
 * - endpoint 自身是浏览器生成的 ~200 字符随机字符串，不可猜测
 */
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const { endpoint, keys } = await request.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "无效的订阅信息" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const existing = db
      .select()
      .from(schema.pushSubscription)
      .where(eq(schema.pushSubscription.endpoint, endpoint))
      .get();

    if (existing) {
      // 安全检查：endpoint 已存在但属于其他用户 → 先删除旧的
      if (existing.userId !== userId) {
        db.delete(schema.pushSubscription)
          .where(
            and(
              eq(schema.pushSubscription.endpoint, endpoint),
              eq(schema.pushSubscription.userId, existing.userId),
            )
          )
          .run();
        // 重新创建
        db.insert(schema.pushSubscription)
          .values({
            userId,
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            platform: "web",
            createdAt: now,
            updatedAt: now,
          })
          .run();
      } else {
        db.update(schema.pushSubscription)
          .set({
            p256dh: keys.p256dh,
            auth: keys.auth,
            updatedAt: now,
          })
          .where(eq(schema.pushSubscription.id, existing.id))
          .run();
      }
    } else {
      db.insert(schema.pushSubscription)
        .values({
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          platform: "web",
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "未登录") {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    console.error("[PushSubscribe] 订阅失败:", e);
    return NextResponse.json({ error: "订阅失败" }, { status: 500 });
  }
}
