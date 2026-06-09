/**
 * GET /api/user — 获取当前用户属性
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getUserId, hashPassword, verifyPassword } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = getUserId(request);
  const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // 不返回密码哈希
  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json(safeUser);
}

export async function PATCH(request: Request) {
  const userId = getUserId(request);
  const { oldPassword, newPassword } = await request.json();

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: "请填写旧密码和新密码" }, { status: 400 });
  }

  if (typeof newPassword !== "string" || newPassword.length < 4) {
    return NextResponse.json({ error: "新密码至少 4 位" }, { status: 400 });
  }

  const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const valid = await verifyPassword(oldPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
  }

  db.update(schema.user)
    .set({
      passwordHash: await hashPassword(newPassword),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.user.id, userId))
    .run();

  return NextResponse.json({ success: true });
}
