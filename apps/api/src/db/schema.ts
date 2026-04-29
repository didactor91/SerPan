/* eslint-disable max-lines-per-function */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import type {
  Project,
  ProjectInstance,
  ProjectDeploy,
  User,
  PasskeyInfo,
} from '@serverctrl/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', '..', 'data', 'serverctrl.db');

let dbInstance: ReturnType<typeof drizzle> | null = null;
let rawDbInstance: Database.Database | null = null;

/**
 * Drizzle table definitions
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  webauthnUserId: text('webauthn_user_id'),
  createdAt: text('created_at').notNull().default("datetime('now')"),
  lastLogin: text('last_login'),
});

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  type: text('type').notNull(),
  path: text('path').notNull(),
  serpanConfigPath: text('serpan_config_path'),
  repo: text('repo'),
  branch: text('branch'),
  deployScript: text('deploy_script'),
  deployStatus: text('deploy_status').default('idle'),
  domain: text('domain'),
  proxyRouteId: text('proxy_route_id'),
  healthCheckUrl: text('health_check_url'),
  healthCheckPort: integer('health_check_port'),
  healthCheckEnabled: integer('health_check_enabled').default(1),
  status: text('status').default('unknown'),
  lastHealthCheck: text('last_health_check'),
  lastDeploy: text('last_deploy'),
  createdAt: text('created_at').notNull().default("datetime('now')"),
  updatedAt: text('updated_at').notNull().default("datetime('now')"),
});

export const projectInstances = sqliteTable('project_instances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  serverName: text('server_name').notNull().default('default'),
  serverHost: text('server_host'),
  port: integer('port'),
  pid: integer('pid'),
  pm2Name: text('pm2_name'),
  containerId: text('container_id'),
  containerStatus: text('container_status'),
  createdAt: text('created_at').notNull().default("datetime('now')"),
  updatedAt: text('updated_at').notNull().default("datetime('now')"),
});

export const projectDeploys = sqliteTable('project_deploys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  branch: text('branch').notNull(),
  commitHash: text('commit_hash').notNull(),
  commitMessage: text('commit_message'),
  status: text('status').notNull(),
  output: text('output'),
  startedAt: text('started_at').notNull().default("datetime('now')"),
  finishedAt: text('finished_at'),
});

export const userPasskeys = sqliteTable('user_passkeys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  deviceType: text('device_type'),
  deviceName: text('device_name'),
  createdAt: text('created_at').notNull().default("datetime('now')"),
});

export const proxySnapshots = sqliteTable('proxy_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  config: text('config').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().default("datetime('now')"),
});

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  method: text('method').notNull(),
  path: text('path').notNull(),
  status: integer('status').notNull(),
  durationMs: integer('duration_ms'),
  bodyHash: text('body_hash'),
  ip: text('ip'),
  createdAt: text('created_at').notNull().default("datetime('now')"),
});

export const metricsHistory = sqliteTable('metrics_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cpuPct: real('cpu_pct'),
  memUsedMb: real('mem_used_mb'),
  memTotalMb: real('mem_total_mb'),
  diskUsedGb: real('disk_used_gb'),
  diskTotalGb: real('disk_total_gb'),
  timestamp: text('timestamp').notNull().default("datetime('now')"),
});

/**
 * SQLite row types - snake_case to match DB columns
 * These represent raw rows before mapping to application types
 */
interface UserRow {
  id: number;
  username: string;
  password_hash: string | null;
  webauthn_user_id: string | null;
  created_at: string;
  last_login: string | null;
}

interface ProjectRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  path: string;
  serpan_config_path: string | null;
  repo: string | null;
  branch: string | null;
  deploy_script: string | null;
  deploy_status: string;
  domain: string | null;
  proxy_route_id: string | null;
  health_check_url: string | null;
  health_check_port: number | null;
  health_check_enabled: number;
  status: string;
  last_health_check: string | null;
  last_deploy: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectInstanceRow {
  id: number;
  project_id: number;
  server_name: string;
  server_host: string | null;
  port: number | null;
  pid: number | null;
  pm2_name: string | null;
  container_id: string | null;
  container_status: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectDeployRow {
  id: number;
  project_id: number;
  branch: string;
  commit_hash: string;
  commit_message: string | null;
  status: string;
  output: string | null;
  started_at: string;
  finished_at: string | null;
}

interface UserPasskeyRow {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: string | null;
  device_name: string | null;
  created_at: string;
}

/**
 * Row mappers - convert snake_case DB rows to camelCase types
 */
function mapUser(row: UserRow): User {
  const user: User = {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
  };
  if (row.last_login !== null) {
    user.lastLogin = row.last_login;
  }
  return user;
}

function mapProject(row: ProjectRow): Project {
  const project: Project = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type as Project['type'],
    path: row.path,
    deployStatus: row.deploy_status as Project['deployStatus'],
    healthCheckEnabled: Boolean(row.health_check_enabled),
    status: row.status as Project['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.description !== null) project.description = row.description;
  if (row.serpan_config_path !== null) project.serpanConfigPath = row.serpan_config_path;
  if (row.repo !== null) project.repo = row.repo;
  if (row.branch !== null) project.branch = row.branch;
  if (row.deploy_script !== null) project.deployScript = row.deploy_script;
  if (row.domain !== null) project.domain = row.domain;
  if (row.proxy_route_id !== null) project.proxyRouteId = row.proxy_route_id;
  if (row.health_check_url !== null) project.healthCheckUrl = row.health_check_url;
  if (row.health_check_port !== null) project.healthCheckPort = row.health_check_port;
  if (row.last_health_check !== null) project.lastHealthCheck = row.last_health_check;
  if (row.last_deploy !== null) project.lastDeploy = row.last_deploy;
  return project;
}

function mapProjectInstance(row: ProjectInstanceRow): ProjectInstance {
  const instance: ProjectInstance = {
    id: row.id,
    projectId: row.project_id,
    serverName: row.server_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.server_host !== null) instance.serverHost = row.server_host;
  if (row.port !== null) instance.port = row.port;
  if (row.pid !== null) instance.pid = row.pid;
  if (row.pm2_name !== null) instance.pm2Name = row.pm2_name;
  if (row.container_id !== null) instance.containerId = row.container_id;
  if (row.container_status !== null) instance.containerStatus = row.container_status;
  return instance;
}

function mapProjectDeploy(row: ProjectDeployRow): ProjectDeploy {
  const deploy: ProjectDeploy = {
    id: row.id,
    projectId: row.project_id,
    branch: row.branch,
    commitHash: row.commit_hash,
    commitMessage: row.commit_message ?? '',
    status: row.status as ProjectDeploy['status'],
    output: row.output ?? '',
    startedAt: row.started_at,
  };
  if (row.finished_at !== null) deploy.finishedAt = row.finished_at;
  return deploy;
}

function mapPasskey(row: UserPasskeyRow): PasskeyInfo {
  return {
    id: row.id,
    credentialId: row.credential_id,
    deviceType: row.device_type,
    deviceName: row.device_name,
    createdAt: row.created_at,
  };
}

// Export mappers for use by services
export { mapUser, mapProject, mapProjectInstance, mapProjectDeploy, mapPasskey };
export type { UserRow, ProjectRow, ProjectInstanceRow, ProjectDeployRow, UserPasskeyRow };

/**
 * Get the Drizzle database instance
 */
export function getDatabase() {
  if (dbInstance) return dbInstance;

  const dataDir = join(__dirname, '..', '..', 'data');
  mkdirSync(dataDir, { recursive: true });

  rawDbInstance = new Database(DB_PATH);
  rawDbInstance.pragma('journal_mode = WAL');
  rawDbInstance.pragma('foreign_keys = ON');

  dbInstance = drizzle(rawDbInstance);

  initializeSchema(rawDbInstance);

  return dbInstance;
}

/**
 * Get the raw database instance for migrations
 */
export function getRawDatabase(): Database.Database {
  if (!rawDbInstance) {
    getDatabase(); // This initializes rawDbInstance too
  }
  if (!rawDbInstance) {
    throw new Error('Failed to initialize raw database');
  }
  return rawDbInstance;
}

function initializeSchema(db: Database.Database): void {
  // Run migrations first to ensure columns exist
  runMigrations(db);

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

function runMigrations(db: Database.Database): void {
  // Migration: Add missing columns to projects table
  const columnsToAdd = [
    { name: 'repo', type: 'TEXT' },
    { name: 'branch', type: 'TEXT' },
    { name: 'deploy_script', type: 'TEXT' },
    {
      name: 'deploy_status',
      type: "TEXT DEFAULT 'idle' CHECK(deploy_status IN ('idle', 'deploying', 'success', 'failed'))",
    },
    { name: 'proxy_route_id', type: 'TEXT' },
  ];

  for (const col of columnsToAdd) {
    try {
      // Check if column exists
      const result = db.prepare(`PRAGMA table_info(projects)`).all() as { name: string }[];
      const exists = result.some((r) => r.name === col.name);
      if (!exists) {
        db.exec(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.type}`);
      }
    } catch {
      // Column might already exist or other issue - skip
    }
  }

  // Migration: Add project_instances table if missing
  try {
    const instancesExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_instances'")
      .get();
    if (!instancesExists) {
      db.exec(`
        CREATE TABLE project_instances (
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
        CREATE INDEX idx_instances_project_id ON project_instances(project_id);
      `);
    }
  } catch {
    // Table might already exist
  }

  // Migration: Add project_deploys table if missing
  try {
    const deploysExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_deploys'")
      .get();
    if (!deploysExists) {
      db.exec(`
        CREATE TABLE project_deploys (
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
        CREATE INDEX idx_deploys_project_id ON project_deploys(project_id);
      `);
    }
  } catch {
    // Table might already exist
  }
}

export function closeDatabase(): void {
  if (rawDbInstance) {
    rawDbInstance.close();
    rawDbInstance = null;
    dbInstance = null;
  }
}
