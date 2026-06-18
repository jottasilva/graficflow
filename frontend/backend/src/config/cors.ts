import type { Env } from "./env.js";

type CorsEnv = Pick<Env, "APP_ORIGIN" | "PUBLIC_APP_URL" | "NODE_ENV">;

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return trimmed;
  }
}

function expandConfiguredOrigins(env: CorsEnv): string[] {
  return [env.APP_ORIGIN, env.PUBLIC_APP_URL]
    .flatMap((value) => value.split(","))
    .map(normalizeOrigin)
    .filter(Boolean);
}

function matchesWildcardOrigin(origin: string, pattern: string): boolean {
  if (!pattern.includes("*")) return false;

  try {
    const originUrl = new URL(origin);
    const patternUrl = new URL(pattern);
    if (originUrl.protocol !== patternUrl.protocol) return false;
    if (patternUrl.port && originUrl.port !== patternUrl.port) return false;

    const wildcardHost = patternUrl.hostname;
    if (!wildcardHost.startsWith("*.")) return false;

    const suffix = wildcardHost.slice(1);
    return originUrl.hostname.endsWith(suffix) && originUrl.hostname.length > suffix.length;
  } catch {
    return false;
  }
}

export function createCorsOriginMatcher(env: CorsEnv): (origin?: string) => boolean {
  const allowedOrigins = expandConfiguredOrigins(env);
  const exactOrigins = new Set(allowedOrigins.filter((origin) => !origin.includes("*")));
  const wildcardOrigins = allowedOrigins.filter((origin) => origin.includes("*"));

  return (origin?: string) => {
    if (!origin) {
      return env.NODE_ENV !== "production";
    }

    if (origin === "null") {
      return env.NODE_ENV !== "production";
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (exactOrigins.has(normalizedOrigin)) return true;
    if (wildcardOrigins.some((pattern) => matchesWildcardOrigin(normalizedOrigin, pattern))) return true;

    if (env.NODE_ENV !== "production") {
      return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalizedOrigin);
    }

    return false;
  };
}
