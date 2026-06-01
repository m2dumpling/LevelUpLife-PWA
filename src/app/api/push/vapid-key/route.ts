/**
 * GET /api/push/vapid-key
 * 公开端点 — 返回 VAPID 公钥供前端订阅使用
 */
import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: "VAPID 未配置" }, { status: 500 });
  }
  return NextResponse.json({ publicKey });
}
