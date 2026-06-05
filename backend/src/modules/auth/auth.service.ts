import type { Env } from "../../config/env.js";
import type { AuthContext } from "../../http/middleware/auth.js";
import type { LoginInput, RecoverPasswordInput, RegisterInput } from "../../http/schemas.js";
import { badRequest, conflict, unauthorized, upstreamError } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";

type KeycloakTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  token_type: string;
};

type KeycloakUser = {
  id: string;
  email?: string;
  username?: string;
};

type BootstrapAdminInput = {
  email: string;
  password: string;
  name: string;
  companyName: string;
  tenantId?: string;
  temporaryPassword?: boolean;
};

function tokenEndpoint(env: Env): string {
  return `${env.KEYCLOAK_ISSUER_URL.replace(/\/$/, "")}/protocol/openid-connect/token`;
}

function keycloakAdminBase(env: Env): string {
  const issuer = new URL(env.KEYCLOAK_ISSUER_URL);
  const match = issuer.pathname.match(/^(.*)\/realms\/([^/]+)\/?$/);

  if (!match) {
    throw badRequest("KEYCLOAK_ISSUER_URL deve apontar para um realm Keycloak.");
  }

  const [, basePath, realm] = match;
  const prefix = `${issuer.origin}${basePath === "/" ? "" : basePath}`;
  return `${prefix}/admin/realms/${realm}`;
}

function splitName(name: string) {
  const [firstName, ...last] = name.trim().split(/\s+/);
  return {
    firstName,
    lastName: last.join(" ") || undefined,
  };
}

function assertAdminConfigured(env: Env) {
  const hasClientCredentials = Boolean(env.KEYCLOAK_ADMIN_CLIENT_ID && env.KEYCLOAK_ADMIN_CLIENT_SECRET);
  const hasPasswordGrant = Boolean(
    env.KEYCLOAK_ADMIN_CLIENT_ID && env.KEYCLOAK_ADMIN_USERNAME && env.KEYCLOAK_ADMIN_PASSWORD,
  );

  if (!hasClientCredentials && !hasPasswordGrant) {
    throw badRequest("Credenciais administrativas do Keycloak nao foram configuradas no backend.");
  }
}

export class AuthService {
  constructor(
    private readonly env: Env,
    private readonly supabase: SupabaseServiceClient,
  ) {}

  async login(input: LoginInput): Promise<KeycloakTokenResponse> {
    if (
      this.env.NODE_ENV !== "production" &&
      this.env.DEV_AUTH_BYPASS &&
      this.env.DEV_ADMIN_PASSWORD &&
      input.email === this.env.DEV_ADMIN_EMAIL &&
      input.password === this.env.DEV_ADMIN_PASSWORD
    ) {
      await this.ensureDevAdmin().catch(() => undefined);
      return {
        access_token: "dev-bypass",
        refresh_token: "dev-bypass",
        expires_in: 3600,
        refresh_expires_in: 86400,
        token_type: "Bearer",
      };
    }

    const body = new URLSearchParams({
      grant_type: "password",
      client_id: this.env.KEYCLOAK_CLIENT_ID,
      client_secret: this.env.KEYCLOAK_CLIENT_SECRET,
      username: input.email,
      password: input.password,
    });

    const response = await fetch(tokenEndpoint(this.env), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const payload = (await response.json().catch(() => null)) as Partial<KeycloakTokenResponse> | null;

    if (!response.ok || !payload?.access_token) {
      throw unauthorized("E-mail ou senha invalidos.");
    }

    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_in: payload.expires_in,
      refresh_expires_in: payload.refresh_expires_in,
      token_type: payload.token_type ?? "Bearer",
    };
  }

  async register(input: RegisterInput) {
    const tenantId = randomId("ten");
    const keycloakUser = await this.createKeycloakUser({
      email: input.email,
      password: input.password,
      name: input.name,
      companyName: input.companyName,
      tenantId,
      temporaryPassword: false,
    });

    await this.upsertTenantAndUser({
      subject: keycloakUser.id,
      tenantId,
      email: input.email,
      name: input.name,
      companyName: input.companyName,
      role: "ADMIN",
    });

    return {
      userId: keycloakUser.id,
      tenantId,
      email: input.email,
    };
  }

  async recoverPassword(input: RecoverPasswordInput) {
    try {
      const adminToken = await this.getAdminToken();
      const user = await this.findKeycloakUser(adminToken, input.email);

      if (user?.id) {
        const response = await fetch(
          `${keycloakAdminBase(this.env)}/users/${encodeURIComponent(user.id)}/execute-actions-email`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${adminToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(["UPDATE_PASSWORD"]),
          },
        );

        if (!response.ok) {
          throw upstreamError("Keycloak nao conseguiu enviar a recuperacao de senha.", {
            status: response.status,
          });
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        // Nao revela se o e-mail existe nem detalhes de Keycloak ao cliente.
      }
    }

    return { delivered: true };
  }

  async bootstrapAdmin(input: BootstrapAdminInput) {
    const tenantId = input.tenantId ?? "graphflow-main";
    const existing = await this.findUserByEmail(input.email);

    if (existing) {
      await this.upsertTenantAndUser({
        subject: existing.id,
        tenantId,
        email: input.email,
        name: input.name,
        companyName: input.companyName,
        role: "ADMIN",
      });
      return { userId: existing.id, tenantId, created: false };
    }

    const adminToken = await this.getAdminToken();
    const keycloakExisting = await this.findKeycloakUser(adminToken, input.email);
    if (keycloakExisting?.id) {
      await this.upsertTenantAndUser({
        subject: keycloakExisting.id,
        tenantId,
        email: input.email,
        name: input.name,
        companyName: input.companyName,
        role: "ADMIN",
      });
      return { userId: keycloakExisting.id, tenantId, created: false };
    }

    const keycloakUser = await this.createKeycloakUser({
      ...input,
      tenantId,
      temporaryPassword: input.temporaryPassword ?? true,
    });

    await this.upsertTenantAndUser({
      subject: keycloakUser.id,
      tenantId,
      email: input.email,
      name: input.name,
      companyName: input.companyName,
      role: "ADMIN",
    });

    return { userId: keycloakUser.id, tenantId, created: true };
  }

  profile(auth: AuthContext) {
    return {
      authenticated: true,
      user: {
        id: auth.userId,
        tenantId: auth.tenantId,
        email: auth.email,
        role: auth.role,
        permissions: auth.permissions,
        sectorIds: auth.sectorIds,
        provider: auth.provider,
      },
    };
  }

  private async createKeycloakUser(input: BootstrapAdminInput & { tenantId: string }): Promise<KeycloakUser> {
    assertAdminConfigured(this.env);
    const adminToken = await this.getAdminToken();
    const existing = await this.findKeycloakUser(adminToken, input.email);

    if (existing?.id) {
      throw conflict("Usuario ja existe no Keycloak.");
    }

    const { firstName, lastName } = splitName(input.name);
    const response = await fetch(`${keycloakAdminBase(this.env)}/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: input.email,
        email: input.email,
        firstName,
        lastName,
        enabled: true,
        emailVerified: false,
        requiredActions: input.temporaryPassword ? ["UPDATE_PASSWORD"] : [],
        attributes: {
          tenantId: [input.tenantId],
          companyName: [input.companyName],
        },
        credentials: [
          {
            type: "password",
            value: input.password,
            temporary: input.temporaryPassword ?? true,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw upstreamError("Keycloak nao conseguiu criar o usuario.", {
        status: response.status,
        body: await response.text().catch(() => ""),
      });
    }

    const location = response.headers.get("location");
    const id = location?.split("/").pop();
    if (!id) {
      const created = await this.findKeycloakUser(adminToken, input.email);
      if (created?.id) return created;
      throw upstreamError("Keycloak criou o usuario, mas nao retornou o identificador.");
    }

    return { id, email: input.email, username: input.email };
  }

  private async getAdminToken(): Promise<string> {
    assertAdminConfigured(this.env);
    const body = new URLSearchParams({
      client_id: this.env.KEYCLOAK_ADMIN_CLIENT_ID ?? this.env.KEYCLOAK_CLIENT_ID,
    });

    if (this.env.KEYCLOAK_ADMIN_CLIENT_SECRET) {
      body.set("grant_type", "client_credentials");
      body.set("client_secret", this.env.KEYCLOAK_ADMIN_CLIENT_SECRET);
    } else {
      body.set("grant_type", "password");
      body.set("username", this.env.KEYCLOAK_ADMIN_USERNAME ?? "");
      body.set("password", this.env.KEYCLOAK_ADMIN_PASSWORD ?? "");
    }

    const response = await fetch(tokenEndpoint(this.env), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const payload = (await response.json().catch(() => null)) as { access_token?: string } | null;

    if (!response.ok || !payload?.access_token) {
      throw upstreamError("Nao foi possivel obter token administrativo do Keycloak.", {
        status: response.status,
      });
    }

    return payload.access_token;
  }

  private async findKeycloakUser(adminToken: string, email: string): Promise<KeycloakUser | null> {
    const params = new URLSearchParams({
      email,
      exact: "true",
      max: "1",
    });

    const response = await fetch(`${keycloakAdminBase(this.env)}/users?${params.toString()}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (!response.ok) {
      throw upstreamError("Keycloak nao conseguiu buscar o usuario.", { status: response.status });
    }

    const users = (await response.json()) as KeycloakUser[];
    return users[0] ?? null;
  }

  private async findUserByEmail(email: string): Promise<{ id: string } | null> {
    const result = await this.supabase.from("users").select("id").eq("email", email).maybeSingle<{ id: string }>();
    assertSupabaseOk(result.error, "buscar usuario");
    return result.data ?? null;
  }

  private async ensureDevAdmin() {
    await this.upsertTenantAndUser({
      subject: this.env.DEV_USER_ID,
      tenantId: this.env.DEV_TENANT_ID,
      email: this.env.DEV_ADMIN_EMAIL,
      name: "Administrador GraphFlow",
      companyName: "GraficFlow",
      role: "ADMIN",
    });
  }

  private async upsertTenantAndUser(input: {
    subject: string;
    tenantId: string;
    email: string;
    name: string;
    companyName: string;
    role: string;
  }) {
    const now = new Date().toISOString();
    const tenant = await this.supabase
      .from("tenants")
      .upsert({
        id: input.tenantId,
        name: input.companyName,
        slug: input.tenantId,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .select("id")
      .single();
    assertSupabaseOk(tenant.error, "criar tenant");

    const user = await this.supabase
      .from("users")
      .upsert({
        id: input.subject,
        tenantId: input.tenantId,
        name: input.name,
        email: input.email,
        role: input.role,
        permissions: ["*"],
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .select("id")
      .single();
    assertSupabaseOk(user.error, "criar perfil do usuario");
  }
}
