/**
 * POST /api/push/unsubscribe
 * 删除浏览器推送订阅
 *
 * 安全：仅允许删除属于自己的订阅
 */
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: "缺少 endpoint" }, { status: 400 });
    }

    // 仅删除当前用户的订阅，防止跨用户删除
    db.delete(schema.pushSubscription)
      .where(
        and(
          eq(schema.pushSubscription.endpoint, endpoint),
          eq(schema.pushSubscription.userId, userId),
        )
      )
      .run();

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "未登录") {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    console.error("[PushUnsubscribe] 取消失败:", e);
    return NextResponse.json({ error: "取消失败" }, { status: 500 });
  }
}
