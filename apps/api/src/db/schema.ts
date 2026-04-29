/* eslint-disable max-lines-per-function */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', '..', 'data', 'serverctrl.db');

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) return dbInstance;

  const dataDir = join(__dirname, '..', '..', 'data');
  mkdirSync(dataDir, { recursive: true });

  dbInstance = new Database(DB_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  initializeSchema(dbInstance);

  return dbInstance;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      webauthn_user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status INTEGER NOT NULL,
      duration_ms INTEGER,
      body_hash TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS metrics_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpu_pct REAL,
      mem_used_mb REAL,
      mem_total_mb REAL,
      disk_used_gb REAL,
      disk_total_gb REAL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_history(timestamp);

    CREATE TABLE IF NOT EXISTS user_passkeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      device_type TEXT,
      device_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON user_passkeys(user_id);

    CREATE TABLE IF NOT EXISTS proxy_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('pm2', 'docker-compose', 'generic')),
      path TEXT NOT NULL,
      serpan_config_path TEXT,
      repo TEXT,
      branch TEXT,
      deploy_script TEXT,
      deploy_status TEXT DEFAULT 'idle' CHECK(deploy_status IN ('idle', 'deploying', 'success', 'failed')),
      domain TEXT,
      proxy_route_id TEXT,
      health_check_url TEXT,
      health_check_port INTEGER,
      health_check_enabled INTEGER DEFAULT 1,
      status TEXT DEFAULT 'unknown' CHECK(status IN ('running', 'stopped', 'error', 'unknown', 'deploying')),
      last_health_check TEXT,
      last_deploy TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      server_name TEXT NOT NULL DEFAULT 'default',
      server_host TEXT,
      port INTEGER,
      pid INTEGER,
      pm2_name TEXT,
      container_id TEXT,
      container_status TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_instances_project_id ON project_instances(project_id);

    CREATE TABLE IF NOT EXISTS project_deploys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      branch TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      commit_message TEXT,
      status TEXT NOT NULL CHECK(status IN ('idle', 'deploying', 'success', 'failed')),
      output TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_deploys_project_id ON project_deploys(project_id);
  `);
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
