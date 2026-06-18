import type { Env } from "../../config/env.js";

type ProviderEnv = Pick<Env, "AUTH_LOGIN_PROVIDER" | "KEYCLOAK_ISSUER_URL">;

export type RuntimeAuthProvider = "keycloak" | "supabase";

export function isLoopbackIssuerUrl(issuerUrl: string): boolean {
  try {
    const hostname = new URL(issuerUrl).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function activeAuthProvider(env: ProviderEnv): RuntimeAuthProvider {
  if (env.AUTH_LOGIN_PROVIDER === "keycloak") return "keycloak";
  if (env.AUTH_LOGIN_PROVIDER === "supabase") return "supabase";
  return isLoopbackIssuerUrl(env.KEYCLOAK_ISSUER_URL) ? "supabase" : "keycloak";
}

export function usesSupabaseAuth(env: ProviderEnv): boolean {
  return activeAuthProvider(env) === "supabase";
}
