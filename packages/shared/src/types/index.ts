export type ProjectType = 'pm2' | 'docker-compose' | 'generic';
export type ProjectStatus = 'running' | 'stopped' | 'error' | 'unknown' | 'deploying';
export type DeployStatus = 'idle' | 'deploying' | 'success' | 'failed';

export interface Project {
  id: number;
  name: string;
  slug: string;
  description?: string;
  type: ProjectType;
  path: string;
  serpanConfigPath?: string;
  repo?: string;
  branch?: string;
  deployScript?: string;
  deployStatus: DeployStatus;
  domain?: string;
  proxyRouteId?: string;
  healthCheckUrl?: string;
  healthCheckPort?: number;
  healthCheckEnabled: boolean;
  status: ProjectStatus;
  lastHealthCheck?: string;
  lastDeploy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInstance {
  id: number;
  projectId: number;
  serverName: string;
  serverHost?: string;
  port?: number;
  pid?: number;
  pm2Name?: string;
  containerId?: string;
  containerStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDeploy {
  id: number;
  projectId: number;
  branch: string;
  commitHash: string;
  commitMessage: string;
  status: DeployStatus;
  output: string;
  startedAt: string;
  finishedAt?: string;
}

export interface SerpanConfig {
  serpan: {
    name: string;
    type: ProjectType;
    path: string;
    healthCheck?: {
      type: 'http';
      url: string;
      port?: number;
    };
    proxy?: {
      domain: string;
      internalPort: number;
      tls?: boolean;
    };
    pm2?: {
      name: string;
    };
  };
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

// WebAuthn types
export interface PasskeyInfo {
  id: number;
  credentialId: string;
  deviceType: string | null;
  deviceName: string | null;
  createdAt: string;
}

export interface WebAuthnRegistrationOptions {
  timeout?: number;
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    name: string;
    displayName: string;
    id: string;
  };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  excludeCredentials?: Array<{ id: string; type: 'public-key' }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey?: 'preferred' | 'required' | 'discouraged';
    requireResidentKey?: boolean;
    userVerification?: 'preferred' | 'required' | 'discouraged';
  };
  attestation?: 'none' | 'indirect' | 'direct';
  extensions?: Record<string, unknown>;
}

export interface WebAuthnAuthenticationOptions {
  timeout?: number;
  challenge: string;
  rpId: string;
  allowCredentials?: Array<{ id: string; type: 'public-key' }>;
  userVerification?: 'preferred' | 'required' | 'discouraged';
  extensions?: Record<string, unknown>;
}
