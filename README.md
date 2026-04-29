# SerPan — Service Hub

A self-hosted service hub for managing multiple projects, deploys, and monitoring on your servers. Built with Express + Socket.io on the backend and React + TanStack Query on the frontend.

## Overview

SerPan gives you a unified dashboard to manage projects, system resources, reverse proxy routes, and logs — all in real-time via WebSockets.

```
┌─────────────────────────────────────────────────────────────┐
│                      SerPan Service Hub                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐     │
│  │ Projects │  │ System   │  │ Proxy    │  │ Logs    │     │
│  │ Registry │  │ Metrics  │  │ Caddy    │  │ Stream  │     │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘     │
│                                                              │
│  API: Express + Socket.io + BetterSQLite3                   │
│  Web: React + TanStack + Recharts + xterm.js                │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Project Registry

- Register and manage multiple projects from a single dashboard
- Auto-discovery via `serpan.json` configuration files
- Support for PM2, Docker Compose, and generic deployment types
- Health monitoring with automatic status updates
- Per-project proxy routing

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
- Automatic route creation for registered projects

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

## Project Integration Guide

SerPan uses a `serpan.json` configuration file to integrate projects. Place this file in your project root to enable auto-discovery.

### Example `serpan.json`

```json
{
  "serpan": {
    "name": "My Project",
    "type": "pm2",
    "path": "/opt/my-project",
    "healthCheck": {
      "type": "http",
      "url": "http://localhost:3000/health",
      "port": 3000
    },
    "proxy": {
      "domain": "myproject.didtor.dev",
      "internalPort": 3000,
      "tls": true
    },
    "pm2": {
      "name": "my-project"
    }
  }
}
```

### Configuration Options

| Field                | Type                                   | Required | Description                        |
| -------------------- | -------------------------------------- | -------- | ---------------------------------- |
| `name`               | string                                 | Yes      | Display name for the project       |
| `type`               | `pm2` \| `docker-compose` \| `generic` | Yes      | Deployment type                    |
| `path`               | string                                 | Yes      | Absolute path to project directory |
| `healthCheck.type`   | `http`                                 | No       | Health check method                |
| `healthCheck.url`    | string                                 | No       | URL to check for health            |
| `healthCheck.port`   | number                                 | No       | Port to monitor                    |
| `proxy.domain`       | string                                 | No       | Domain for reverse proxy           |
| `proxy.internalPort` | number                                 | No       | Internal port for proxy            |
| `proxy.tls`          | boolean                                | No       | Enable TLS (default: true)         |
| `pm2.name`           | string                                 | No       | PM2 process name                   |

### Supported Project Types

- **pm2**: Node.js projects managed by PM2
- **docker-compose**: Multi-container applications
- **generic**: Custom deployments with health check URL

## Architecture

```
apps/
├── api/                  # Express backend
│   └── src/
│       ├── api/routes/   # Auth, projects, processes, system, proxy, logs
│       ├── services/     # PM2, Caddy, project, discovery, health, system metrics, log stream
│       ├── middleware/    # JWT auth, error handling
│       ├── db/            # SQLite schema + connection
│       ├── websocket/     # Socket.io server
│       └── lib/           # Logger, config
└── web/                  # React frontend
    └── src/
        ├── pages/         # Dashboard, Projects, Processes, Proxy, Logs
        ├── components/    # Reusable UI components
        ├── hooks/         # API + WebSocket hooks
        └── stores/        # Zustand stores
packages/
└── shared/               # Shared TypeScript types
```

## API Design

All routes are prefixed with `/api/v1`. Authentication uses JWT access tokens passed via `Authorization: Bearer <token>` header or `accessToken` cookie.

| Route                      | Method | Auth | Description                        |
| -------------------------- | ------ | ---- | ---------------------------------- |
| **Auth**                   |        |      |                                    |
| `/auth/login`              | POST   | No   | Login with username/password       |
| `/auth/refresh`            | POST   | No   | Refresh access token               |
| `/auth/logout`             | POST   | Yes  | Invalidate refresh token           |
| **Projects**               |        |      |                                    |
| `/projects`                | GET    | Yes  | List all registered projects       |
| `/projects`                | POST   | Yes  | Create a new project               |
| `/projects/:slug`          | GET    | Yes  | Get project by slug                |
| `/projects/:slug`          | PUT    | Yes  | Update project                     |
| `/projects/:slug`          | DELETE | Yes  | Delete project                     |
| `/projects/discover`       | GET    | Yes  | Discover projects from serpan.json |
| `/projects/:slug/health`   | GET    | Yes  | Check project health               |
| **Processes**              |        |      |                                    |
| `/processes`               | GET    | Yes  | List all PM2 processes             |
| `/processes/:name/restart` | POST   | Yes  | Restart a process                  |
| `/processes/:name/stop`    | POST   | Yes  | Stop a process                     |
| `/processes/scale`         | POST   | Yes  | Scale process count                |
| **System**                 |        |      |                                    |
| `/system/metrics`          | GET    | Yes  | Current CPU, memory, disk          |
| `/system/metrics/history`  | GET    | Yes  | Historical metrics                 |
| **Proxy**                  |        |      |                                    |
| `/proxy/routes`            | GET    | Yes  | List Caddy routes                  |
| `/proxy/routes`            | POST   | Yes  | Create a route                     |
| `/proxy/routes/:id`        | PUT    | Yes  | Update a route                     |
| `/proxy/routes/:id`        | DELETE | Yes  | Delete a route                     |
| `/proxy/domains`           | GET    | Yes  | List configured domains            |
| **Logs**                   |        |      |                                    |
| `/logs/stream`             | WS     | Yes  | Real-time log stream               |

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
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
NODE_ENV=development
PORT=4000
CADDY_API_URL=http://localhost:2019
```

## Quality Gates

| Check      | Command          | Threshold               |
| ---------- | ---------------- | ----------------------- |
| TypeScript | `pnpm typecheck` | 0 errors                |
| ESLint     | `pnpm lint`      | 0 errors (warnings OK)  |
| Tests      | `pnpm test`      | ≥80% coverage, all pass |

## License

Private — all rights reserved.
