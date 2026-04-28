# SerPan — Server Control Panel

A self-hosted server management dashboard for operating a personal homelab or VPS. Built with Express + Socket.io on the backend and React + TanStack Query on the frontend.

## Overview

SerPan gives you a unified UI to manage system processes, monitor resource usage, configure reverse proxy routes, and stream logs — all in real-time via WebSockets.

```
┌─────────────────────────────────────────────────────────┐
│  SerPan                                                 │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │Processes │  │ System   │  │ Proxy    │  │ Logs    │  │
│  │  PM2     │  │ Metrics  │  │ Caddy    │  │ Stream  │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │
│                                                         │
│  API: Express + Socket.io + BetterSQLite3              │
│  Web: React + TanStack + Recharts + xterm.js           │
└─────────────────────────────────────────────────────────┘
```

## Features

### Process Management

- Start, stop, scale, and restart services via **PM2**
- View process status, memory, and CPU usage in real-time
- Persistent process configuration stored in SQLite

### System Monitoring

- Live CPU, memory, and disk usage metrics
- Historical metrics stored in SQLite (for charting)
- Metrics streamed to the UI via WebSocket

### Reverse Proxy

- Manage **Caddy** routes through the UI
- Add/remove domains, upstream ports, and TLS settings
- Routes persisted in SQLite and applied to Caddy's config

### Log Streaming

- Real-time log streaming via **Socket.io** WebSocket
- Terminal-like rendering with **xterm.js**
- Auto-reconnect on connection drop

### Authentication & Audit

- JWT-based authentication (access + refresh tokens)
- Audit log of all API requests (method, path, status, duration, IP)
- Secure cookie-based session management

## Tech Stack

| Layer               | Technology                                |
| ------------------- | ----------------------------------------- |
| **API**             | Express 4, Socket.io, TypeScript (strict) |
| **Database**        | BetterSQLite3 (SQLite)                    |
| **Process Manager** | PM2 (programmatic API)                    |
| **Reverse Proxy**   | Caddy (programmatic config)               |
| **Web**             | React 18, TanStack Query, TanStack Router |
| **Charts**          | Recharts                                  |
| **Terminal**        | xterm.js                                  |
| **State**           | Zustand                                   |
| **Validation**      | Zod                                       |
| **Styling**         | Tailwind CSS                              |
| **Testing**         | Vitest, Supertest                         |
| **Linting**         | ESLint 9 (flat config), TypeScript ESLint |

## Architecture

```
apps/
├── api/                  # Express backend
│   └── src/
│       ├── api/routes/   # Auth, processes, system, proxy, logs
│       ├── services/     # PM2, Caddy, system metrics, log stream
│       ├── middleware/    # JWT auth, error handling
│       ├── db/            # SQLite schema + connection
│       ├── websocket/     # Socket.io server
│       └── lib/           # Logger, config
└── web/                  # React frontend
    └── src/
        ├── pages/         # Dashboard, processes, metrics, proxy, logs
        ├── components/    # Reusable UI components
        ├── hooks/         # API + WebSocket hooks
        └── stores/        # Zustand auth store
packages/
└── shared/               # Shared TypeScript types
```

## API Design

All routes are prefixed with `/api/v1`. Authentication uses JWT access tokens passed via `Authorization: Bearer <token>` header or `accessToken` cookie.

| Route                      | Method | Auth | Description                  |
| -------------------------- | ------ | ---- | ---------------------------- |
| `/auth/login`              | POST   | No   | Login with username/password |
| `/auth/refresh`            | POST   | No   | Refresh access token         |
| `/auth/logout`             | POST   | Yes  | Invalidate refresh token     |
| `/processes`               | GET    | Yes  | List all PM2 processes       |
| `/processes/:name/restart` | POST   | Yes  | Restart a process            |
| `/processes/:name/stop`    | POST   | Yes  | Stop a process               |
| `/processes/scale`         | POST   | Yes  | Scale process count          |
| `/system/metrics`          | GET    | Yes  | Current CPU, memory, disk    |
| `/system/metrics/history`  | GET    | Yes  | Historical metrics           |
| `/proxy/routes`            | GET    | Yes  | List Caddy routes            |
| `/proxy/routes`            | POST   | Yes  | Create a route               |
| `/proxy/routes/:id`        | PUT    | Yes  | Update a route               |
| `/proxy/routes/:id`        | DELETE | Yes  | Delete a route               |
| `/proxy/domains`           | GET    | Yes  | List configured domains      |
| `/logs/stream`             | WS     | Yes  | Real-time log stream         |

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- PM2 (for process management)
- Caddy (for reverse proxy)

### Setup

```bash
# Install dependencies
pnpm install

# Start dev servers (API + Web in parallel)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

### Environment Variables

```bash
# apps/api/.env
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
NODE_ENV=development
PORT=3000
DB_PATH=./data/serverctrl.db
CADDY_CONFIG_PATH=/etc/caddy/Caddyfile
LOG_DIR=./logs
```

```bash
# apps/web/.env
VITE_API_URL=http://localhost:3000
```

## Quality Gates

| Check      | Command          | Threshold               |
| ---------- | ---------------- | ----------------------- |
| TypeScript | `pnpm typecheck` | 0 errors                |
| ESLint     | `pnpm lint`      | 0 errors (warnings OK)  |
| Tests      | `pnpm test`      | ≥80% coverage, all pass |

## License

Private — all rights reserved.
