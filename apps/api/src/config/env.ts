import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PROXY_TYPE: z.enum(['caddy', 'nginx']).default('caddy'),
  CADDY_API_URL: z.string().url().default('http://localhost:2019'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017'),
  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().default('serverctrl_readonly'),
  MYSQL_PASSWORD: z.string().default(''),
  BACKUP_DIR: z.string().default('/var/serverctrl/backups'),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(7),
  ALERT_CPU_THRESHOLD: z.coerce.number().default(85),
  ALERT_MEMORY_THRESHOLD: z.coerce.number().default(90),
  ALERT_CERT_EXPIRY_DAYS: z.coerce.number().default(14),
  WEBAUTHN_RP_ID: z.string().default('serpan.local'),
  WEBAUTHN_RP_NAME: z.string().default('ServerCtrl'),
});

export type Env = z.infer<typeof envSchema>;

let envInstance: Env | null = null;

export function loadEnv(): Env {
  if (envInstance) return envInstance;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid environment variables: ${errors}`);
  }

  envInstance = result.data;
  return envInstance;
}

export function getEnv(): Env {
  if (!envInstance) {
    return loadEnv();
  }
  return envInstance;
}
