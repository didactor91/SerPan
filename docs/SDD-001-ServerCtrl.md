# SDD-001 — ServerCtrl: Software Design Document
**Proyecto:** Panel de Control de Servidor Ubuntu  
**Versión:** 1.0  
**Autor:** Didac  
**Fecha:** Abril 2026  
**Estado:** Borrador  
**RFC de referencia:** RFC-001

---

## Tabla de Contenidos
1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Arquitectura de Alto Nivel](#2-arquitectura-de-alto-nivel)
3. [Estructura del Proyecto (Monorepo)](#3-estructura-del-proyecto-monorepo)
4. [Backend — Design Detail](#4-backend--design-detail)
5. [Frontend — Design Detail](#5-frontend--design-detail)
6. [Módulos Funcionales — Diseño Detallado](#6-módulos-funcionales--diseño-detallado)
7. [Modelo de Datos](#7-modelo-de-datos)
8. [API REST Contract](#8-api-rest-contract)
9. [WebSocket Events](#9-websocket-events)
10. [Seguridad](#10-seguridad)
11. [Configuración y Variables de Entorno](#11-configuración-y-variables-de-entorno)
12. [Testing Strategy](#12-testing-strategy)
13. [Despliegue del Panel](#13-despliegue-del-panel)
14. [Decisiones de Diseño (ADR)](#14-decisiones-de-diseño-adr)

---

## 1. Visión General del Sistema

**ServerCtrl** es una aplicación web full-stack instalada directamente en el servidor Ubuntu. Actúa como una capa de orquestación que comunica la UI del administrador con los servicios subyacentes del sistema operativo: PM2, Caddy/Nginx, bases de datos, servicios TCP, y el servidor de email.

### 1.1 Principios de Diseño

- **Seguridad primero.** El panel tiene acceso privilegiado al servidor. Cualquier operación potencialmente destructiva requiere confirmación y queda auditada.
- **El SSH siempre funciona.** El panel es una capa de conveniencia. Si falla, el servidor sigue siendo accesible y operable por SSH. El panel no modifica configuraciones de forma que requiera su propio funcionamiento para revertir.
- **Configuración como código.** Las configuraciones generadas (Caddyfile, ecosystem.config.js) son legibles por humanos y versionables en git.
- **Operaciones atómicas con rollback.** Antes de cualquier cambio de configuración crítico, se guarda un snapshot. El rollback es una operación de primer nivel, no un afterthought.
- **Latencia mínima percibida.** Las métricas y logs se envían via WebSocket. La UI no hace polling; recibe push de datos.

---

## 2. Arquitectura de Alto Nivel

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Caddy / Nginx  (Reverse Proxy + TLS Termination)               │
│                                                                   │
│  panel.didtor.dev     ──► localhost:4000  (ServerCtrl Backend)  │
│  didtor.dev           ──► localhost:3001  (Astro static)        │
│  tortoisegps.didtor.dev ► localhost:3002  (React/Node app)      │
│  api.tortoisegps.*    ──► localhost:3003  (Node API)            │
└─────────────────────────────────────────────────────────────────┘
    │
    │  localhost
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ServerCtrl (puerto 4000)                       │
│                                                                   │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │  REST API    │  │  WebSocket    │  │  Static Frontend     │ │
│  │  /api/v1/*   │  │  Server       │  │  (React build)       │ │
│  └──────┬───────┘  └───────┬───────┘  └──────────────────────┘ │
│         │                  │                                      │
│  ┌──────▼──────────────────▼────────────────────────────────┐   │
│  │                   Core Services Layer                      │   │
│  │                                                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │   │
│  │  │ PM2      │ │ Proxy    │ │  System  │ │  Database  │  │   │
│  │  │ Manager  │ │ Manager  │ │  Monitor │ │  Manager   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │   │
│  │  │  TCP     │ │  Email   │ │   Log    │ │  Config    │  │   │
│  │  │ Monitor  │ │ Manager  │ │  Stream  │ │   Store    │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  SQLite DB (estado, config, audit log)                           │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼  Sistema Operativo / Servicios
┌─────────────────────────────────────────────────────────────────┐
│  PM2          │  Caddy/Nginx  │  MongoDB  │  MySQL  │  Postfix  │
│  systemd      │  UFW (fw)     │           │         │           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Estructura del Proyecto (Monorepo)

```
serverctrl/
├── package.json                 # pnpm workspaces root
├── pnpm-workspace.yaml
├── turbo.json                   # Turborepo pipeline
├── .env.example
│
├── apps/
│   ├── api/                     # Backend Node.js + Express
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point
│   │   │   ├── config/
│   │   │   │   └── env.ts       # Zod-validated env vars
│   │   │   ├── api/
│   │   │   │   ├── router.ts
│   │   │   │   └── routes/
│   │   │   │       ├── auth.routes.ts
│   │   │   │       ├── projects.routes.ts
│   │   │   │       ├── proxy.routes.ts
│   │   │   │       ├── processes.routes.ts
│   │   │   │       ├── databases.routes.ts
│   │   │   │       ├── tcp.routes.ts
│   │   │   │       ├── email.routes.ts
│   │   │   │       └── system.routes.ts
│   │   │   ├── services/
│   │   │   │   ├── pm2.service.ts
│   │   │   │   ├── caddy.service.ts
│   │   │   │   ├── nginx.service.ts
│   │   │   │   ├── systemMetrics.service.ts
│   │   │   │   ├── logStream.service.ts
│   │   │   │   ├── mongodb.service.ts
│   │   │   │   ├── mysql.service.ts
│   │   │   │   ├── tcpMonitor.service.ts
│   │   │   │   ├── email.service.ts
│   │   │   │   └── configStore.service.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── audit.middleware.ts
│   │   │   │   └── errorHandler.ts
│   │   │   ├── db/
│   │   │   │   ├── schema.ts    # better-sqlite3 schema
│   │   │   │   └── migrations/
│   │   │   └── websocket/
│   │   │       ├── wsServer.ts
│   │   │       └── handlers/
│   │   │           ├── metrics.handler.ts
│   │   │           └── logs.handler.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                     # Frontend React + Vite
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── router.tsx        # TanStack Router
│       │   ├── stores/           # Zustand stores
│       │   │   ├── auth.store.ts
│       │   │   └── notifications.store.ts
│       │   ├── api/              # TanStack Query hooks
│       │   │   ├── projects.api.ts
│       │   │   ├── proxy.api.ts
│       │   │   ├── processes.api.ts
│       │   │   └── ...
│       │   ├── components/
│       │   │   ├── ui/           # shadcn/ui components
│       │   │   ├── layout/
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   ├── TopBar.tsx
│       │   │   │   └── Layout.tsx
│       │   │   └── shared/
│       │   │       ├── StatusBadge.tsx
│       │   │       ├── MetricCard.tsx
│       │   │       ├── ConfirmDialog.tsx
│       │   │       └── LogViewer.tsx
│       │   └── pages/
│       │       ├── Dashboard/
│       │       ├── Projects/
│       │       ├── ProxyManager/
│       │       ├── ProcessManager/
│       │       ├── Databases/
│       │       ├── TCPServers/
│       │       ├── Email/
│       │       ├── Logs/
│       │       ├── SystemMetrics/
│       │       └── Settings/
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                  # Tipos y schemas compartidos
│       ├── src/
│       │   ├── types/
│       │   │   ├── project.types.ts
│       │   │   ├── process.types.ts
│       │   │   ├── proxy.types.ts
│       │   │   └── metrics.types.ts
│       │   └── schemas/         # Zod schemas (validación frontend + backend)
│       └── package.json
│
├── scripts/
│   ├── install.sh               # Instalación en servidor nuevo
│   ├── backup.sh                # Backup de configuraciones
│   └── update.sh                # Actualización del panel
│
└── ecosystem.config.js          # PM2 config para el propio panel
```

---

## 4. Backend — Design Detail

### 4.1 Stack y Dependencias Clave

```json
{
  "dependencies": {
    "express": "^4.19",
    "socket.io": "^4.7",
    "better-sqlite3": "^9.x",
    "pm2": "^5.x",
    "jsonwebtoken": "^9.x",
    "bcryptjs": "^2.x",
    "zod": "^3.x",
    "node-os-utils": "^1.x",
    "chokidar": "^3.x",
    "execa": "^8.x",
    "mysql2": "^3.x",
    "mongodb": "^6.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "vitest": "^1.x"
  }
}
```

### 4.2 PM2 Service

El servicio interactúa con PM2 usando su API de módulo (no como CLI). Esto permite operaciones síncronas sin spawn de procesos.

```typescript
// services/pm2.service.ts
import pm2 from 'pm2';

export class PM2Service {
  private connected = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      pm2.connect((err) => err ? reject(err) : resolve());
      this.connected = true;
    });
  }

  async list(): Promise<PM2Process[]> {
    return new Promise((resolve, reject) => {
      pm2.list((err, list) => err ? reject(err) : resolve(list));
    });
  }

  async restart(nameOrId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      pm2.restart(nameOrId, (err) => err ? reject(err) : resolve());
    });
  }

  async scale(name: string, instances: number): Promise<void> {
    return new Promise((resolve, reject) => {
      pm2.scale(name, instances, (err) => err ? reject(err) : resolve());
    });
  }

  async getLogs(name: string): Promise<LogLine[]> {
    // Lee desde el archivo de log de PM2
    // ~/.pm2/logs/{name}-out.log + {name}-error.log
  }
}
```

### 4.3 Proxy Service (Caddy)

Caddy expone una API REST en `localhost:2019` para gestión en caliente sin reload. Esta es la integración preferida frente a editar el Caddyfile a mano.

```typescript
// services/caddy.service.ts
export class CaddyService {
  private apiBase = 'http://localhost:2019';

  async getConfig(): Promise<CaddyConfig> {
    const res = await fetch(`${this.apiBase}/config/`);
    return res.json();
  }

  async addRoute(route: CaddyRoute): Promise<void> {
    // POST /config/apps/http/servers/srv0/routes/
    await fetch(`${this.apiBase}/config/apps/http/servers/srv0/routes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route)
    });
    await this.saveSnapshot();
  }

  async removeRoute(routeId: string): Promise<void> {
    await this.saveSnapshot();
    await fetch(`${this.apiBase}/id/${routeId}`, { method: 'DELETE' });
  }

  private async saveSnapshot(): Promise<void> {
    // Guarda el config actual en SQLite como rollback point
    const config = await this.getConfig();
    configStore.saveProxySnapshot('caddy', JSON.stringify(config));
  }

  async rollback(snapshotId: string): Promise<void> {
    const snapshot = configStore.getProxySnapshot(snapshotId);
    await fetch(`${this.apiBase}/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: snapshot.config
    });
  }
}
```

**Estructura de una ruta Caddy generada:**
```json
{
  "@id": "route_tortoisegps",
  "match": [{ "host": ["tortoisegps.didtor.dev"] }],
  "handle": [{
    "handler": "reverse_proxy",
    "upstreams": [{ "dial": "localhost:3002" }]
  }],
  "terminal": true
}
```

### 4.4 System Metrics Service

```typescript
// services/systemMetrics.service.ts
import osu from 'node-os-utils';

export class SystemMetricsService {
  async getSnapshot(): Promise<SystemMetrics> {
    const [cpu, mem, drive] = await Promise.all([
      osu.cpu.usage(),
      osu.mem.info(),
      osu.drive.info('/')
    ]);

    return {
      cpu: { usage: cpu },
      memory: {
        total: mem.totalMemMb,
        used: mem.usedMemMb,
        free: mem.freeMemMb,
        usagePercent: mem.usedMemPercentage
      },
      disk: {
        total: drive.totalGb,
        used: drive.usedGb,
        free: drive.freeGb,
        usagePercent: drive.usedPercentage
      },
      timestamp: Date.now()
    };
  }
}
```

### 4.5 Log Stream Service

```typescript
// services/logStream.service.ts
import { Tail } from 'tail';
import { Server as SocketServer } from 'socket.io';

export class LogStreamService {
  private activeTails = new Map<string, Tail>();

  startStream(io: SocketServer, socketId: string, logPath: string): void {
    const tail = new Tail(logPath, { useWatchFile: true });
    
    tail.on('line', (line: string) => {
      io.to(socketId).emit('log:line', { path: logPath, line, timestamp: Date.now() });
    });

    this.activeTails.set(`${socketId}:${logPath}`, tail);
  }

  stopStream(socketId: string, logPath: string): void {
    const key = `${socketId}:${logPath}`;
    this.activeTails.get(key)?.unwatch();
    this.activeTails.delete(key);
  }
}
```

### 4.6 Audit Middleware

```typescript
// middleware/audit.middleware.ts
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      db.run(`
        INSERT INTO audit_log (user_id, method, path, status, duration_ms, body_hash, ip, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.user?.id ?? 'anonymous',
        req.method,
        req.path,
        res.statusCode,
        Date.now() - start,
        hash(JSON.stringify(req.body)),
        req.ip,
        new Date().toISOString()
      ]);
    }
  });
  next();
}
```

---

## 5. Frontend — Design Detail

### 5.1 Stack y Dependencias Clave

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "@tanstack/react-router": "^1.x",
    "@tanstack/react-query": "^5.x",
    "socket.io-client": "^4.x",
    "zustand": "^4.x",
    "recharts": "^2.x",
    "xterm": "^5.x",
    "tailwindcss": "^3.x",
    "@shadcn/ui": "latest",
    "lucide-react": "latest",
    "date-fns": "^3.x",
    "zod": "^3.x"
  }
}
```

### 5.2 Layout Global

```
┌─────────────────────────────────────────────────────┐
│  TopBar: Logo | ServerCtrl | Alerts badge | Avatar  │
├──────────┬──────────────────────────────────────────┤
│          │                                           │
│ Sidebar  │  Page Content Area                       │
│          │                                           │
│ • Overview    │  (Varía según la ruta activa)       │
│ • Projects    │                                      │
│ • Proxy       │                                      │
│ • Processes   │                                      │
│ • Databases   │                                      │
│ • TCP Servers │                                      │
│ • Email       │                                      │
│ • Logs        │                                      │
│ • System      │                                      │
│ • Settings    │                                      │
│          │                                           │
└──────────┴──────────────────────────────────────────┘
```

### 5.3 WebSocket Client

```typescript
// stores/wsClient.ts
import { io, Socket } from 'socket.io-client';

class WSClient {
  private socket: Socket | null = null;

  connect(token: string) {
    this.socket = io('/', {
      auth: { token },
      transports: ['websocket']
    });

    this.socket.on('connect_error', (err) => {
      console.error('WS connection failed:', err.message);
    });
  }

  subscribeMetrics(cb: (metrics: SystemMetrics) => void) {
    this.socket?.on('metrics:update', cb);
    this.socket?.emit('metrics:subscribe');
  }

  subscribeLog(logPath: string, cb: (line: LogLine) => void) {
    this.socket?.on('log:line', (data) => {
      if (data.path === logPath) cb(data);
    });
    this.socket?.emit('log:subscribe', { path: logPath });
  }
}

export const wsClient = new WSClient();
```

### 5.4 Componente StatusBadge

```typescript
// components/shared/StatusBadge.tsx
type Status = 'online' | 'stopped' | 'errored' | 'launching' | 'unknown';

const statusConfig: Record<Status, { label: string; classes: string }> = {
  online:    { label: 'Online',    classes: 'bg-green-100 text-green-800 border-green-200' },
  stopped:   { label: 'Stopped',   classes: 'bg-gray-100 text-gray-600 border-gray-200' },
  errored:   { label: 'Error',     classes: 'bg-red-100 text-red-800 border-red-200' },
  launching: { label: 'Starting',  classes: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  unknown:   { label: 'Unknown',   classes: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, classes } = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {label}
    </span>
  );
}
```

---

## 6. Módulos Funcionales — Diseño Detallado

### 6.1 Dashboard Overview

**Componentes:**
- `ProjectCard` — tarjeta por proyecto con: nombre, dominio, StatusBadge, CPU%, RAM MB, uptime.
- `ServerSummary` — widget con CPU/RAM/Disco del servidor en tiempo real.
- `AlertsPanel` — lista de alertas activas (proceso caído, cert próximo a expirar).

**Flujo de datos:**
1. Al montar, `useQuery` carga snapshot inicial desde `GET /api/v1/projects`.
2. WS suscribe a `metrics:update` (cada 5s) y actualiza los valores en las tarjetas.
3. Si un proceso cambia de estado (online→errored), el backend emite `process:status-change` y se actualiza el badge sin refetch.

### 6.2 Proxy Manager

**UI Flows:**

*Añadir nuevo dominio/subdominio:*
```
[Botón "New Route"] → 
  Modal con formulario:
    - Hostname (ej: "nuevoproyecto.didtor.dev")
    - Upstream port (ej: 3004)
    - TLS: auto (Caddy) | custom cert | none
    - Headers adicionales (opcional)
    - [Preview config] → muestra bloque Caddyfile resultante
    - [Apply] → POST /api/v1/proxy/routes → recarga config → toast "Route added"
```

*Historial de cambios:*
- Tabla con: fecha, operación, qué se cambió, quién, botón "Rollback".
- Rollback muestra diff del config actual vs snapshot y pide confirmación.

### 6.3 Process Manager

**Tabla de procesos:**

| Nombre | Estado | PID | CPU% | RAM | Workers | Uptime | Acciones |
|---|---|---|---|---|---|---|---|
| tortoisegps-api | 🟢 Online | 1234 | 2.1% | 128MB | 2 | 3d 4h | ⏹ ↺ ⊕ |
| tortoisegps-tcp | 🟢 Online | 1235 | 0.3% | 45MB | 1 | 3d 4h | ⏹ ↺ |
| didtor-landing | 🟢 Online | 1236 | 0.1% | 38MB | 1 | 7d 2h | ⏹ ↺ |

**Escalado de workers:**
- Click en el número de workers → input inline → confirmar → `POST /api/v1/processes/{name}/scale { instances: N }`.
- Animación durante el scaling.

### 6.4 Log Viewer

```
┌─ Log Viewer ─────────────────────────────────────────┐
│  [Proceso ▾] [Nivel: ALL ▾]  [🔍 filter...]  [⬇ DL] │
├──────────────────────────────────────────────────────┤
│  xterm.js embedded terminal                          │
│                                                       │
│  [2026-04-28 10:23:01] INFO  Server started on 3002  │
│  [2026-04-28 10:23:15] INFO  MongoDB connected        │
│  [2026-04-28 10:24:02] WARN  Slow query detected (...)│
│  ▊                                                    │
└──────────────────────────────────────────────────────┘
  [◼ Stop stream]  [⟳ Resume]  Buffer: 500 lines
```

- El xterm.js usa colores ANSI para diferenciar niveles (verde=info, amarillo=warn, rojo=error).
- "Stop stream" pausa el WS sin desconectar, permitiendo scroll y búsqueda.

### 6.5 TCP Server Monitor

```typescript
// Datos expuestos por el backend para cada servidor TCP
interface TCPServerStatus {
  name: string;           // "tortoisegps-tcp"
  port: number;           // 8080
  protocol: 'tcp' | 'udp';
  status: 'listening' | 'closed' | 'error';
  activeConnections: number;
  totalConnectionsToday: number;
  bytesIn: number;
  bytesOut: number;
  pid: number;
  uptime: number;
}
```

**Obtención de datos:** El backend usa `ss -tlnp` o `netstat` parseado via `execa`, combinado con los datos de PM2 para asociar PID ↔ nombre de proceso.

### 6.6 Database Manager

**MongoDB:**
```
Databases: [serverctrl_cfg] [tortoisegps_db] [...]
─────────────────────────────────────────────────────
tortoisegps_db
  Collections: users (12,430 docs) | tracks (891,200 docs) | devices (89 docs)
  Tamaño: 2.3 GB  |  Índices: 8  |  Conexiones activas: 3
  [Backup ahora]  [Ver conexiones]
```

**MySQL:**
```
Schemas: [new_project_db] [...]
─────────────────────────────
new_project_db
  Tablas: 12  |  Tamaño: 340 MB  |  Conexiones activas: 5
  [Backup ahora]  [Ver procesos]
```

Backup genera un dump a `/var/serverctrl/backups/{db}_{timestamp}.sql.gz` y muestra el progreso en tiempo real via WS.

---

## 7. Modelo de Datos

### SQLite Schema (base de datos interna del panel)

```sql
-- Configuración del único usuario admin
CREATE TABLE users (
  id          INTEGER PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  last_login  TEXT
);

-- Proyectos registrados en el panel
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,  -- slug: "tortoisegps"
  name        TEXT NOT NULL,
  domain      TEXT NOT NULL,     -- "tortoisegps.didtor.dev"
  description TEXT,
  stack       TEXT,              -- JSON: ["react", "nodejs", "mongodb", "tcp"]
  pm2_name    TEXT,              -- nombre en PM2 si aplica
  port        INTEGER,           -- puerto local del upstream
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Snapshots de configuración del proxy para rollback
CREATE TABLE proxy_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  proxy_type  TEXT NOT NULL,     -- "caddy" | "nginx"
  config      TEXT NOT NULL,     -- JSON/text del config completo
  description TEXT,              -- "Before adding tortoisegps route"
  created_at  TEXT NOT NULL
);

-- Log de auditoría de todas las operaciones
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  method      TEXT NOT NULL,
  path        TEXT NOT NULL,
  status      INTEGER NOT NULL,
  duration_ms INTEGER,
  body_hash   TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL
);

-- Alertas activas y resueltas
CREATE TABLE alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,     -- "process_down" | "cert_expiry" | "high_cpu"
  severity    TEXT NOT NULL,     -- "info" | "warning" | "critical"
  project_id  TEXT,
  message     TEXT NOT NULL,
  resolved    INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL,
  resolved_at TEXT
);

-- Histórico de métricas (últimas 24h, se purga automáticamente)
CREATE TABLE metrics_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cpu_pct     REAL,
  mem_used_mb REAL,
  mem_total_mb REAL,
  disk_used_gb REAL,
  timestamp   TEXT NOT NULL
);
CREATE INDEX idx_metrics_timestamp ON metrics_history(timestamp);
```

---

## 8. API REST Contract

Base URL: `/api/v1`

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Login con username + password, devuelve JWT |
| `POST` | `/auth/logout` | Invalida el token |
| `GET` | `/auth/me` | Info del usuario actual |

### Projects

| Method | Path | Description |
|---|---|---|
| `GET` | `/projects` | Lista todos los proyectos con su estado actual |
| `GET` | `/projects/:id` | Detalle de un proyecto |
| `POST` | `/projects` | Registra nuevo proyecto en el panel |
| `PUT` | `/projects/:id` | Actualiza metadata del proyecto |
| `DELETE` | `/projects/:id` | Elimina el proyecto del panel (no desinstala del servidor) |

### Processes (PM2 + systemd)

| Method | Path | Description |
|---|---|---|
| `GET` | `/processes` | Lista todos los procesos PM2 |
| `POST` | `/processes/:name/start` | Inicia proceso |
| `POST` | `/processes/:name/stop` | Detiene proceso |
| `POST` | `/processes/:name/restart` | Reinicia proceso |
| `POST` | `/processes/:name/reload` | Graceful reload (0-downtime) |
| `POST` | `/processes/:name/scale` | Escala workers `{ instances: number }` |
| `GET` | `/processes/:name/logs` | Últimas N líneas de log |

### Proxy

| Method | Path | Description |
|---|---|---|
| `GET` | `/proxy/config` | Config completa del proxy |
| `GET` | `/proxy/routes` | Lista de rutas/virtual hosts |
| `POST` | `/proxy/routes` | Añade nueva ruta |
| `PUT` | `/proxy/routes/:id` | Modifica una ruta |
| `DELETE` | `/proxy/routes/:id` | Elimina una ruta |
| `GET` | `/proxy/snapshots` | Lista de snapshots para rollback |
| `POST` | `/proxy/rollback/:snapshotId` | Aplica rollback a un snapshot |
| `GET` | `/proxy/certs` | Estado de certificados TLS |

### Databases

| Method | Path | Description |
|---|---|---|
| `GET` | `/databases` | Estado de todas las bases de datos |
| `GET` | `/databases/mongo` | Info MongoDB |
| `GET` | `/databases/mysql` | Info MySQL/MariaDB |
| `POST` | `/databases/:type/:name/backup` | Inicia backup (responde con jobId) |
| `GET` | `/databases/backups` | Lista de backups disponibles |

### System

| Method | Path | Description |
|---|---|---|
| `GET` | `/system/metrics` | Snapshot actual de métricas |
| `GET` | `/system/metrics/history` | Histórico (query param: `?hours=24`) |
| `GET` | `/system/tcp` | Estado de servidores TCP activos |
| `GET` | `/system/firewall` | Reglas UFW activas |

### Email

| Method | Path | Description |
|---|---|---|
| `GET` | `/email/status` | Estado del servidor de email |
| `GET` | `/email/queue` | Cola de emails pendientes |
| `GET` | `/email/dns/:domain` | DNS records requeridos para el dominio |

---

## 9. WebSocket Events

### Cliente → Servidor (emit)

| Event | Payload | Descripción |
|---|---|---|
| `metrics:subscribe` | — | Suscribirse a métricas en tiempo real |
| `metrics:unsubscribe` | — | Cancelar suscripción |
| `log:subscribe` | `{ path: string }` | Iniciar stream de un log |
| `log:unsubscribe` | `{ path: string }` | Detener stream de un log |
| `process:subscribe` | `{ name: string }` | Recibir eventos de un proceso |

### Servidor → Cliente (on)

| Event | Payload | Descripción |
|---|---|---|
| `metrics:update` | `SystemMetrics` | Snapshot de métricas (cada 5s) |
| `log:line` | `{ path, line, timestamp }` | Nueva línea de log |
| `process:status-change` | `{ name, oldStatus, newStatus }` | Cambio de estado de proceso |
| `alert:new` | `Alert` | Nueva alerta generada |
| `alert:resolved` | `{ id: string }` | Alerta resuelta |
| `backup:progress` | `{ jobId, percent, message }` | Progreso de un backup |

---

## 10. Seguridad

### 10.1 Autenticación

- Login retorna JWT con expiración de 8 horas.
- Token se almacena en `httpOnly cookie` (no localStorage) para prevenir XSS.
- Refresh token con expiración de 30 días en otra cookie httpOnly.
- Rate limiting en `/auth/login`: máximo 5 intentos por IP en 15 minutos.

### 10.2 Autorización

- Todos los endpoints de `/api/v1/*` requieren JWT válido.
- Las operaciones destructivas (DELETE, rollback, scale) tienen un campo `confirmationToken` en el body que el frontend debe generar mostrando al usuario el impacto de la acción.

### 10.3 Hardening del Panel

```
# El proceso del panel corre como usuario no-root "serverctrl"
# con acceso limitado via sudo a operaciones específicas:

# /etc/sudoers.d/serverctrl
serverctrl ALL=(ALL) NOPASSWD: /bin/systemctl restart caddy
serverctrl ALL=(ALL) NOPASSWD: /bin/systemctl reload caddy
serverctrl ALL=(ALL) NOPASSWD: /usr/sbin/ufw status
# ... solo los comandos necesarios
```

- El panel NO tiene acceso root. Las operaciones que lo requieren van via sudo con comandos permitidos explícitamente.
- Los archivos de configuración del proxy son propiedad del usuario `serverctrl` para no necesitar sudo en lectura/escritura.

### 10.4 Headers de Seguridad

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:"],
    }
  },
  hsts: { maxAge: 31536000 }
}));
```

---

## 11. Configuración y Variables de Entorno

```bash
# .env (en el servidor, nunca en git)

# Panel
PORT=4000
NODE_ENV=production
JWT_SECRET=<secret-aleatorio-256-bits>
JWT_REFRESH_SECRET=<otro-secret>

# Proxy
PROXY_TYPE=caddy                   # "caddy" | "nginx"
CADDY_API_URL=http://localhost:2019
NGINX_CONFIG_PATH=/etc/nginx/sites-available
NGINX_RELOAD_CMD="sudo systemctl reload nginx"

# Bases de datos
MONGODB_URI=mongodb://localhost:27017
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=serverctrl_readonly
MYSQL_PASSWORD=<password>

# Email
EMAIL_SERVER_TYPE=postfix           # "postfix" | "mailcow"
POSTFIX_STATUS_CMD="sudo systemctl status postfix"

# Backups
BACKUP_DIR=/var/serverctrl/backups
BACKUP_RETENTION_DAYS=7

# Alertas
ALERT_CPU_THRESHOLD=85              # % para disparar alerta
ALERT_MEMORY_THRESHOLD=90
ALERT_CERT_EXPIRY_DAYS=14           # Días antes de expiración para alertar
```

---

## 12. Testing Strategy

### Unit Tests (Vitest)

Prioridad en los servicios críticos:
- `caddy.service.ts` — construcción de rutas, validación de config.
- `pm2.service.ts` — parsing de respuestas de PM2 API.
- `configStore.service.ts` — operaciones de SQLite.
- Todos los endpoints REST: request validation + response shape.

### Integration Tests

- Test de flujo completo: login → añadir ruta proxy → verificar config → rollback.
- Test de WebSocket: conectar, suscribir a métricas, recibir al menos 1 update.

### E2E (Playwright) — Opcional v1

- Login flow.
- Restart de un proceso desde la UI.
- Añadir subdominio desde Proxy Manager.

### Smoke Tests en producción

Script `scripts/health-check.sh` que verifica:
- Panel responde en `panel.didtor.dev`.
- JWT auth funciona.
- PM2 API conecta.
- Caddy API responde.
- SQLite accesible.

---

## 13. Despliegue del Panel

### Instalación inicial

```bash
# En el servidor como usuario con sudo
git clone https://github.com/didac/serverctrl /opt/serverctrl
cd /opt/serverctrl

# Instalar dependencias
pnpm install

# Build
pnpm build

# Configurar entorno
cp .env.example .env
nano .env  # Rellenar valores

# Crear usuario del sistema
sudo useradd -r -s /sbin/nologin serverctrl
sudo chown -R serverctrl:serverctrl /opt/serverctrl

# Configurar sudoers
sudo cp scripts/serverctrl.sudoers /etc/sudoers.d/serverctrl

# Arrancar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Para que arranque con el sistema

# Configurar Caddy para exponer el panel
# Añadir al Caddyfile:
# panel.didtor.dev {
#   reverse_proxy localhost:4000
# }
```

### ecosystem.config.js (el panel gestionándose a sí mismo)

```javascript
module.exports = {
  apps: [{
    name: 'serverctrl',
    script: './apps/api/dist/index.js',
    cwd: '/opt/serverctrl',
    env: { NODE_ENV: 'production' },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '200M',
    log_file: '/var/log/serverctrl/combined.log',
    out_file: '/var/log/serverctrl/out.log',
    error_file: '/var/log/serverctrl/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
```

### Actualización

```bash
# scripts/update.sh
cd /opt/serverctrl
git pull
pnpm install
pnpm build
pm2 reload serverctrl  # 0-downtime reload
```

---

## 14. Decisiones de Diseño (ADR)

### ADR-001: Caddy como proxy por defecto

**Decisión:** Caddy es el proxy por defecto, con soporte opcional de Nginx.  
**Razón:** La API REST de Caddy (`localhost:2019`) permite modificar la configuración en caliente sin editar ficheros ni hacer reload. Simplifica enormemente el Proxy Manager. Nginx requeriría manipulación de ficheros + `nginx -t` + reload, que es más frágil.  
**Trade-off:** Caddy es menos conocido que Nginx en entornos legacy, pero para un servidor personal es la elección correcta.

### ADR-002: SQLite como base de datos del panel

**Decisión:** SQLite con `better-sqlite3`.  
**Razón:** El panel es una aplicación single-node. SQLite elimina la dependencia de un servidor de base de datos externo, simplifica el backup (copiar un fichero), y es más que suficiente para el volumen de datos del panel.

### ADR-003: PM2 API de módulo vs CLI

**Decisión:** PM2 API de módulo (`require('pm2')`).  
**Razón:** Más eficiente que spawn de procesos, permite operaciones asíncronas más limpias, y el módulo está bien documentado y estable.  
**Caveat:** El backend debe llamar `pm2.connect()` al iniciar y `pm2.disconnect()` al apagar limpiamente.

### ADR-004: JWT en httpOnly cookies vs localStorage

**Decisión:** httpOnly cookies.  
**Razón:** El panel es un objetivo de alto valor (acceso al servidor). Almacenar JWTs en localStorage los expone a XSS. Las cookies httpOnly son inaccesibles desde JavaScript.  
**Implicación:** El frontend envía requests con `credentials: 'include'` y el backend configura `sameSite: 'strict'`.

### ADR-005: Monorepo con pnpm workspaces + Turborepo

**Decisión:** Monorepo.  
**Razón:** Frontend y backend comparten tipos (paquete `@serverctrl/shared`). Un solo repositorio simplifica el desarrollo y el despliegue. Turborepo gestiona el build pipeline con caché inteligente.

---

*SDD-001 v1.0 — Living document, se actualiza conforme avanza la implementación*
