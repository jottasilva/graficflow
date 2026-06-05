import { z } from "zod";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });
loadDotenv();

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  APP_ORIGIN: z.string().min(1),
  PUBLIC_APP_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
  DATABASE_URL: z.string().url().optional(),
  KEYCLOAK_ISSUER_URL: z.string().url(),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(12),
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().min(1).optional(),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().min(12).optional(),
  KEYCLOAK_ADMIN_USERNAME: z.string().min(1).optional(),
  KEYCLOAK_ADMIN_PASSWORD: z.string().min(1).optional(),
  SUPABASE_AUTH_CALLBACK_URL: z.string().url(),
  AUTH_COOKIE_NAME: z.string().min(3).default("graphflow_session"),
  AUTH_REFRESH_COOKIE_NAME: z.string().min(3).default("graphflow_refresh"),
  AUTH_COOKIE_DOMAIN: z.string().min(3).optional(),
  QUOTE_PUBLIC_TOKEN_PEPPER: z.string().min(32),
  PDF_STORAGE_BUCKET: z.string().min(3).default("quote-pdfs"),
  UPLOAD_STORAGE_BUCKET: z.string().min(3).default("graphflow-uploads"),
  DEV_AUTH_BYPASS: z.coerce.boolean().default(false),
  DEV_TENANT_ID: z.string().min(1).default("demo-tenant"),
  DEV_USER_ID: z.string().min(1).default("dev-user"),
  DEV_ADMIN_EMAIL: z.string().email().default("admin@email.com"),
  DEV_ADMIN_PASSWORD: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
