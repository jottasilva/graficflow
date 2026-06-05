import type { FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Env } from "../../config/env.js";
import { forbidden, unauthorized } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";

type UserRow = {
  id: string;
  tenantId: string | null;
  email: string | null;
  role: string | null;
  permissions: string[] | null;
  sectorIds: string[];
};

type UserProfileRow = Omit<UserRow, "sectorIds">;

export type AuthContext = {
  token: string;
  userId: string;
  tenantId?: string;
  email?: string;
  role: string;
  permissions: string[];
  sectorIds: string[];
  provider: "supabase" | "keycloak";
  claims: JWTPayload;
};

export type AuthProvider = {
  verifyToken(token: string): Promise<AuthContext>;
  requireAuth(request: FastifyRequest): Promise<AuthContext>;
};

function getBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw unauthorized();
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw unauthorized();
  }

  return token;
}

function getOptionalBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function getOptionalCookieToken(request: FastifyRequest, cookieName: string): string | null {
  const cookies = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies;
  const token = cookies?.[cookieName]?.trim();
  return token || null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function hasExpectedAudience(payload: JWTPayload, clientId: string): boolean {
  const aud = payload.aud;
  const azp = asString((payload as { azp?: unknown }).azp);

  if (azp === clientId) return true;
  if (typeof aud === "string") return aud === clientId;
  if (Array.isArray(aud)) return aud.includes(clientId);

  return false;
}

async function resolveUser(
  supabase: SupabaseServiceClient,
  subject: string,
  email?: string,
): Promise<UserRow | null> {
  const byId = await supabase
    .from("users")
    .select("id,tenantId,email,role,permissions")
    .eq("id", subject)
    .is("deletedAt", null)
    .maybeSingle<UserProfileRow>();

  if (byId.error) throw unauthorized("Nao foi possivel validar o usuario.");
  if (byId.data) return withSectorIds(supabase, byId.data);
  if (!email) return null;

  const byEmail = await supabase
    .from("users")
    .select("id,tenantId,email,role,permissions")
    .eq("email", email)
    .is("deletedAt", null)
    .maybeSingle<UserProfileRow>();

  if (byEmail.error) throw unauthorized("Nao foi possivel validar o usuario.");
  return byEmail.data ? withSectorIds(supabase, byEmail.data) : null;
}

async function withSectorIds(
  supabase: SupabaseServiceClient,
  user: UserProfileRow,
): Promise<UserRow> {
  if (!user.tenantId) return { ...user, sectorIds: [] };

  const result = await supabase
    .from("user_sector_permissions")
    .select("sectorId")
    .eq("tenantId", user.tenantId)
    .eq("userId", user.id)
    .eq("canRead", true);

  if (result.error?.code === "42P01") return { ...user, sectorIds: [] };
  if (result.error) throw unauthorized("Nao foi possivel validar setores do usuario.");

  return {
    ...user,
    sectorIds: (result.data ?? []).map((row) => String(row.sectorId)),
  };
}

export function createAuthProvider(env: Env, supabase: SupabaseServiceClient): AuthProvider {
  const issuer = env.KEYCLOAK_ISSUER_URL.replace(/\/$/, "");
  const jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));

  async function verifySupabaseToken(token: string): Promise<AuthContext | null> {
    const userResult = await supabase.auth.getUser(token);
    if (userResult.error || !userResult.data.user) return null;

    const user = userResult.data.user;
    const profile = await resolveUser(supabase, user.id, user.email);
    const appMetadata = user.app_metadata as Record<string, unknown>;
    const tenantId = profile?.tenantId ?? asString(appMetadata.tenantId) ?? asString(appMetadata.tenant_id);

    return {
      token,
      userId: profile?.id ?? user.id,
      tenantId,
      email: profile?.email ?? user.email ?? undefined,
      role: profile?.role ?? asString(appMetadata.role) ?? "VIEWER",
      permissions: profile?.permissions ?? [],
      sectorIds: profile?.sectorIds ?? [],
      provider: "supabase",
      claims: {
        sub: user.id,
        email: user.email,
        app_metadata: user.app_metadata,
      },
    };
  }

  async function verifyKeycloakToken(token: string): Promise<AuthContext> {
    const verified = await jwtVerify(token, jwks, { issuer });

    if (!hasExpectedAudience(verified.payload, env.KEYCLOAK_CLIENT_ID)) {
      throw unauthorized("Token Keycloak nao pertence a este cliente.");
    }

    const subject = verified.payload.sub;
    if (!subject) throw unauthorized("Token sem subject.");

    const email = asString(verified.payload.email);
    const profile = await resolveUser(supabase, subject, email);
    const tenantId =
      profile?.tenantId ??
      asString((verified.payload as { tenantId?: unknown }).tenantId) ??
      asString((verified.payload as { tenant_id?: unknown }).tenant_id);

    return {
      token,
      userId: profile?.id ?? subject,
      tenantId,
      email: profile?.email ?? email,
      role: profile?.role ?? asString((verified.payload as { role?: unknown }).role) ?? "VIEWER",
      permissions: profile?.permissions ?? [],
      sectorIds: profile?.sectorIds ?? [],
      provider: "keycloak",
      claims: verified.payload,
    };
  }

  async function verifyToken(token: string): Promise<AuthContext> {
    if (token === "dev-bypass" && env.NODE_ENV !== "production" && env.DEV_AUTH_BYPASS) {
      return {
        token,
        userId: env.DEV_USER_ID,
        tenantId: env.DEV_TENANT_ID,
        email: env.DEV_ADMIN_EMAIL,
        role: "ADMIN",
        permissions: ["*"],
        sectorIds: [],
        provider: "keycloak",
        claims: { sub: env.DEV_USER_ID, tenantId: env.DEV_TENANT_ID },
      };
    }

    const supabaseContext = await verifySupabaseToken(token);
    if (supabaseContext) return supabaseContext;

    try {
      return await verifyKeycloakToken(token);
    } catch {
      throw unauthorized("Sessao invalida ou expirada.");
    }
  }

  return {
    verifyToken,

    async requireAuth(request: FastifyRequest): Promise<AuthContext> {
      let token = getOptionalBearerToken(request);
      token = token ?? getOptionalCookieToken(request, env.AUTH_COOKIE_NAME);

      if (!token && env.NODE_ENV !== "production" && env.DEV_AUTH_BYPASS) {
        return {
          token: "dev-bypass",
          userId: env.DEV_USER_ID,
          tenantId: env.DEV_TENANT_ID,
          email: "dev@graphflow.local",
          role: "ADMIN",
          permissions: ["*"],
          sectorIds: [],
          provider: "keycloak",
          claims: { sub: env.DEV_USER_ID, tenantId: env.DEV_TENANT_ID },
        };
      }

      if (!token) token = getBearerToken(request);
      return verifyToken(token);
    },
  };
}

export function assertTenantAccess(auth: AuthContext, tenantId: string): void {
  if (!auth.tenantId) {
    throw forbidden("Usuario sem tenant vinculado.");
  }

  if (auth.tenantId !== tenantId) {
    throw forbidden("Usuario nao pertence ao tenant informado.");
  }
}

export function hasPermission(auth: AuthContext, permission: string): boolean {
  return auth.role === "ADMIN" || auth.permissions.includes("*") || auth.permissions.includes(permission);
}

export function assertPermission(auth: AuthContext, permission: string): void {
  if (!hasPermission(auth, permission)) {
    throw forbidden("Usuario sem permissao para esta acao.");
  }
}

export function canAccessSector(auth: AuthContext, sectorId: string | null | undefined): boolean {
  if (!sectorId || auth.role === "ADMIN" || auth.permissions.includes("*")) return true;
  return auth.sectorIds.includes(sectorId);
}

export function assertSectorAccess(auth: AuthContext, sectorId: string | null | undefined): void {
  if (!canAccessSector(auth, sectorId)) {
    throw forbidden("Usuario sem permissao para este setor.");
  }
}

export function assertCompanyAccess(auth: AuthContext, companyId: string): void {
  assertTenantAccess(auth, companyId);
}
