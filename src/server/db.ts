import "server-only";
import { createClient, type Client, type InArgs, type InValue } from "@libsql/client";
import { DB_FILE, ensureDirs } from "./paths";

let client: Client | null = null;
let ready: Promise<void> | null = null;

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     is_admin INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS provider_keys (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     provider TEXT NOT NULL,
     ciphertext TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, provider)
   )`,
  `CREATE TABLE IF NOT EXISTS projects (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS projects_user ON projects(user_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS assets (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     run_id TEXT NOT NULL,
     provider TEXT NOT NULL,
     model_id TEXT NOT NULL,
     kind TEXT NOT NULL,
     prompt TEXT NOT NULL,
     negative_prompt TEXT,
     settings TEXT NOT NULL,
     media TEXT NOT NULL,
     media_refs TEXT,
     seed INTEGER,
     url TEXT NOT NULL,
     local_file TEXT,
     thumb_file TEXT,
     width INTEGER,
     height INTEGER,
     duration REAL,
     cost_credits REAL,
     cost_usd REAL,
     favorite INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS assets_user ON assets(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS assets_project ON assets(project_id)`,
  `CREATE TABLE IF NOT EXISTS runs (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     provider TEXT NOT NULL,
     model_id TEXT NOT NULL,
     kind TEXT NOT NULL,
     input TEXT NOT NULL,
     media_refs TEXT,
     count INTEGER NOT NULL,
     job_id TEXT,
     status TEXT NOT NULL,
     progress REAL,
     error TEXT,
     error_code TEXT,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS runs_user ON runs(user_id)`,
  `CREATE TABLE IF NOT EXISTS uploads (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     name TEXT NOT NULL,
     type TEXT NOT NULL,
     size INTEGER NOT NULL,
     file TEXT NOT NULL,
     width INTEGER,
     height INTEGER,
     duration REAL,
     remotes TEXT NOT NULL DEFAULT '{}',
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS uploads_user ON uploads(user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS prompts (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     text TEXT NOT NULL,
     last_used_at INTEGER NOT NULL,
     uses INTEGER NOT NULL DEFAULT 1,
     PRIMARY KEY (user_id, text)
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     key TEXT NOT NULL,
     value TEXT NOT NULL,
     PRIMARY KEY (user_id, key)
   )`,
];

async function migrate(c: Client): Promise<void> {
  await c.execute("PRAGMA journal_mode = WAL");
  await c.execute("PRAGMA foreign_keys = ON");
  for (const sql of MIGRATIONS) await c.execute(sql);
}

/** One libsql client per process, migrated on first use. */
export async function db(): Promise<Client> {
  if (!client) {
    ensureDirs();
    client = createClient({ url: `file:${DB_FILE}` });
  }
  if (!ready) ready = migrate(client);
  await ready;
  return client;
}

type Rec = Record<string, unknown>;

export async function one<T extends Rec = Rec>(sql: string, args: InArgs = []): Promise<T | null> {
  const c = await db();
  const r = await c.execute({ sql, args });
  return (r.rows[0] as unknown as T | undefined) ?? null;
}

export async function all<T extends Rec = Rec>(sql: string, args: InArgs = []): Promise<T[]> {
  const c = await db();
  const r = await c.execute({ sql, args });
  return r.rows as unknown as T[];
}

export async function run(sql: string, args: InArgs = []): Promise<number> {
  const c = await db();
  const r = await c.execute({ sql, args });
  return r.rowsAffected;
}

/** Several statements in one transaction. */
export async function batch(stmts: { sql: string; args?: InArgs }[]): Promise<void> {
  const c = await db();
  if (stmts.length === 0) return;
  await c.batch(
    stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write",
  );
}

export type { InValue };

export function newId(): string {
  return crypto.randomUUID();
}
