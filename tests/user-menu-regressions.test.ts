import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const projectRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), "leveluplife-pwa-user-menu-"));
const dbPath = join(tempDir, "test.db");

process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

function applyMigration(sqlite: Database.Database, file: string) {
  const sql = readFileSync(join(projectRoot, "drizzle", "migrations", file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) sqlite.exec(trimmed);
  }
}

const sqlite = new Database(dbPath);
applyMigration(sqlite, "0000_chief_calypso.sql");
applyMigration(sqlite, "0001_nosy_skrulls.sql");
applyMigration(sqlite, "0002_gift_seen_at.sql");
sqlite.close();

test("account avatar menu is mounted beside Navbar like the web version", () => {
  const navbarSource = readFileSync(join(projectRoot, "src", "components", "Navbar.tsx"), "utf8");
  const pageSource = readFileSync(join(projectRoot, "src", "app", "page.tsx"), "utf8");

  assert.doesNotMatch(navbarSource, /import\s+\{\s*UserMenu\s*\}\s+from\s+["']@\/components\/UserMenu["']/);
  assert.doesNotMatch(navbarSource, /<UserMenu\s*\/>/);
  assert.match(pageSource, /import\s+\{\s*UserMenu\s*\}\s+from\s+["']@\/components\/UserMenu["']/);
  assert.match(pageSource, /<div\s+className="flex items-center gap-2">\s*<Navbar\s+stats=\{stats\}\s*\/>\s*<UserMenu\s*\/>\s*<\/div>/s);
});

test("user PATCH changes password only when the current password is valid", async () => {
  const [{ db, schema }, { eq }, auth, userRoute] = await Promise.all([
    import("../src/lib/db"),
    import("drizzle-orm"),
    import("../src/lib/auth"),
    import("../src/app/api/user/route"),
  ]);

  assert.equal(typeof userRoute.PATCH, "function");

  db.insert(schema.user)
    .values({
      id: 42,
      username: "alice",
      name: "Alice",
      passwordHash: await auth.hashPassword("old-pass"),
      level: 3,
      xp: 80,
      xpToNext: 120,
      gold: 50,
      hp: 100,
      maxHp: 100,
      totalDays: 1,
      streakDays: 0,
      bestStreak: 0,
      storyProgress: "chapter_0",
      hpPenaltyActive: false,
      role: "user",
      banned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .run();

  const bad = await userRoute.PATCH(
    new Request("http://localhost/api/user", {
      method: "PATCH",
      headers: { "x-user-id": "42", "content-type": "application/json" },
      body: JSON.stringify({ oldPassword: "wrong", newPassword: "new-pass" }),
    }),
  );
  assert.equal(bad.status, 400);

  const unchanged = db.select().from(schema.user).where(eq(schema.user.id, 42)).get();
  assert.ok(unchanged);
  assert.equal(await auth.verifyPassword("old-pass", unchanged.passwordHash), true);

  const ok = await userRoute.PATCH(
    new Request("http://localhost/api/user", {
      method: "PATCH",
      headers: { "x-user-id": "42", "content-type": "application/json" },
      body: JSON.stringify({ oldPassword: "old-pass", newPassword: "new-pass" }),
    }),
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { success: true });

  const updated = db.select().from(schema.user).where(eq(schema.user.id, 42)).get();
  assert.ok(updated);
  assert.equal(await auth.verifyPassword("new-pass", updated.passwordHash), true);
});
