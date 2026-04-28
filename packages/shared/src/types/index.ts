// Project types
export interface Project {
  id: string;
  name: string;
  domain: string;
  description?: string;
  stack?: string[];
  pm2Name?: string;
  port?: number;
  createdAt: string;
  updatedAt: string;
}

// PM2 Process types
export type ProcessStatus = 'online' | 'stopped' | 'errored' | 'launching' | 'unknown';

export interface PM2Process {
  name: string;
  status: ProcessStatus;
  pid: number;
  cpu: number;
  memory: number;
  instances: number;
  uptime: number;
}

// System metrics types
export interface SystemMetrics {
  cpu: {
    usage: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  timestamp: number;
}

export interface MetricsHistoryPoint extends SystemMetrics {
  id?: number;
}

// Proxy types
export type ProxyType = 'caddy' | 'nginx';

export interface ProxyRoute {
  id: string;
  host: string;
  upstreamPort: number;
  tls: boolean;
  headers?: Record<string, string>;
}

export interface ProxySnapshot {
  id?: number;
  proxyType: ProxyType;
  config: string;
  description?: string;
  createdAt: string;
}

// Alert types
export type AlertType = 'process_down' | 'cert_expiry' | 'high_cpu' | 'high_memory';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: number;
  type: AlertType;
  severity: AlertSeverity;
  projectId?: string;
  message: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

// Auth types
export interface User {
  id: number;
  username: string;
  createdAt: string;
  lastLogin?: string;
}

export interface JWTPayload {
  userId: number;
  username: string;
  iat?: number;
  exp?: number;
}

// API Response types
export interface ApiError {
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
}

export interface ApiSuccess<T> {
  data: T;
}

// Log types
export interface LogLine {
  processName: string;
  line: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
}
