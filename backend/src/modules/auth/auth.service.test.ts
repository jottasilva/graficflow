import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Env } from "../../config/env.js";
import type { SupabasePasswordAuthClient, SupabaseServiceClient } from "../../shared/supabase/client.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { AuthService } from "./auth.service.js";

const baseEnv: Env = {
  NODE_ENV: "production",
  PORT: 8080,
  APP_ORIGIN: "https://graficflow-frontend.vercel.app",
  PUBLIC_APP_URL: "https://graficflow-frontend.vercel.app",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_123",
  SUPABASE_SECRET_KEY: "sb_secret_test_key_123456",
  SUPABASE_SERVICE_ROLE_KEY: "service_role_test_key_12345678901234567890",
  KEYCLOAK_ISSUER_URL: "http://127.0.0.1:8081/realms/graphflow",
  KEYCLOAK_CLIENT_ID: "graphflow",
  KEYCLOAK_CLIENT_SECRET: "keycloak-client-secret",
  AUTH_LOGIN_PROVIDER: "auto",
  SUPABASE_AUTH_CALLBACK_URL: "https://example.supabase.co/auth/v1/callback",
  AUTH_COOKIE_NAME: "graphflow_session",
  AUTH_REFRESH_COOKIE_NAME: "graphflow_refresh",
  QUOTE_PUBLIC_TOKEN_PEPPER: "12345678901234567890123456789012",
  PDF_STORAGE_BUCKET: "quote-pdfs",
  UPLOAD_STORAGE_BUCKET: "graphflow-uploads",
  UPLOAD_MAX_MB: 25,
  DEV_AUTH_BYPASS: false,
  DEV_TENANT_ID: "graphflow-main",
  DEV_USER_ID: "dev-user",
  DEV_ADMIN_EMAIL: "admin@email.com",
};

describe("AuthService.login", () => {
  it("uses Supabase Auth when Keycloak issuer is loopback in auto mode", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      throw new Error("Keycloak should not be called for loopback issuer.");
    };

    const calls: unknown[] = [];
    const supabase = {} as unknown as SupabaseServiceClient;
    const passwordAuth = {
      auth: {
        signInWithPassword: async (credentials: unknown) => {
          calls.push(credentials);
          return {
            data: {
              session: {
                access_token: "supabase-access-token",
                refresh_token: "supabase-refresh-token",
                expires_in: 3600,
                token_type: "bearer",
              },
            },
            error: null,
          };
        },
      },
    } as unknown as SupabasePasswordAuthClient;

    const auth = new AuthService(baseEnv, supabase, passwordAuth);
    const result = await auth.login({
      email: "admin@email.com",
      password: "senha-segura",
      remember: true,
    });

    assert.equal(result.access_token, "supabase-access-token");
    assert.equal(result.refresh_token, "supabase-refresh-token");
    assert.deepEqual(calls, [{ email: "admin@email.com", password: "senha-segura" }]);
  });

  it("returns a controlled upstream error when Keycloak is selected but unreachable", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8081");
    };

    const supabase = {} as unknown as SupabaseServiceClient;
    const passwordAuth = {
      auth: {
        signInWithPassword: async () => {
          throw new Error("Supabase should not be called when Keycloak is forced.");
        },
      },
    } as unknown as SupabasePasswordAuthClient;

    const auth = new AuthService(
      {
        ...baseEnv,
        AUTH_LOGIN_PROVIDER: "keycloak",
      },
      supabase,
      passwordAuth,
    );

    await assert.rejects(
      () =>
        auth.login({
          email: "admin@email.com",
          password: "senha-segura",
          remember: true,
        }),
      (error) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 502);
        assert.equal(error.message, "Servico de autenticacao indisponivel.");
        return true;
      },
    );
  });
});
