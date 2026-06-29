import { NextResponse } from "next/server";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH || "./data/levelup.db";

/** 首次加载时缓存所有合法表名，后续请求复用（表结构在运行时不变） */
let cachedTableNames: string[] | null = null;

function getAllowedTables(): string[] {
  if (!cachedTableNames) {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    const rows = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[];
    sqlite.close();
    cachedTableNames = rows.map((r) => r.name);
  }
  return cachedTableNames;
}

function validateTable(table: string): void {
  if (!getAllowedTables().includes(table)) {
    throw new Error(`Invalid table: ${table}`);
  }
}

function getDB() {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return sqlite;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");

    if (!table) {
      return NextResponse.json(getAllowedTables());
    }

    validateTable(table);
    const sqlite = getDB();

    const rows = sqlite.prepare(`SELECT * FROM "${table}" LIMIT 100`).all();
    const cols = sqlite.prepare(`PRAGMA table_info("${table}")`).all();
    sqlite.close();

    return NextResponse.json({ columns: cols, rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, table, id, data } = await request.json();
    if (!table || !action) {
      return NextResponse.json({ error: "缺少 table 或 action" }, { status: 400 });
    }

    validateTable(table);
    const sqlite = getDB();

    // 获取列名（确保 data 中的 key 是合法列名）
    const cols = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as {
      name: string;
    }[];
    const colNames = new Set(cols.map((c) => c.name));

    if (action === "update" && id) {
      const entries = Object.entries(data).filter(
        ([k]) => colNames.has(k) && k !== "id"
      );
      if (entries.length === 0) {
        sqlite.close();
        return NextResponse.json({ success: false, error: "无可更新的列" });
      }

      const setClauses = entries.map(([k]) => `"${k}" = ?`).join(", ");
      const values = entries.map(([, v]) => v ?? null);
      sqlite
        .prepare(`UPDATE "${table}" SET ${setClauses} WHERE id = ?`)
        .run(...values, id);
    } else if (action === "delete" && id) {
      sqlite.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
    } else if (action === "insert") {
      const entries = Object.entries(data).filter(
        ([k]) => colNames.has(k) && k !== "id"
      );
      if (entries.length === 0) {
        sqlite.close();
        return NextResponse.json({ success: false, error: "无可插入的列" });
      }

      const keys = entries.map(([k]) => `"${k}"`);
      const placeholders = entries.map(() => "?");
      const values = entries.map(([, v]) => v ?? null);
      sqlite
        .prepare(
          `INSERT INTO "${table}" (${keys.join(",")}) VALUES (${placeholders.join(",")})`
        )
        .run(...values);
    } else {
      sqlite.close();
      return NextResponse.json({ error: "无效的 action" }, { status: 400 });
    }

    sqlite.close();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
