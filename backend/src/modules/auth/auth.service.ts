import type { Env } from "../../config/env.js";
import type { AuthContext } from "../../http/middleware/auth.js";
import type { LoginInput, RecoverPasswordInput, RegisterInput } from "../../http/schemas.js";
import { badRequest, conflict, unauthorized, upstreamError } from "../../shared/errors/http-error.js";
import {
  createSupabasePasswordAuthClient,
  type SupabasePasswordAuthClient,
  type SupabaseServiceClient,
} from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { activeAuthProvider } from "./provider-selection.js";

type AuthTokenResponse = {
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

type ProviderUser = {
  id: string;
  email?: string;
  created: boolean;
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
    private readonly passwordAuth: SupabasePasswordAuthClient = createSupabasePasswordAuthClient(env),
  ) {}

  async login(input: LoginInput): Promise<AuthTokenResponse> {
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

    if (activeAuthProvider(this.env) === "supabase") {
      return this.loginWithSupabase(input);
    }

    return this.loginWithKeycloak(input);
  }

  private async loginWithSupabase(input: LoginInput): Promise<AuthTokenResponse> {
    const result = await this.passwordAuth.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    const session = result.data.session;
    if (result.error || !session?.access_token) {
      throw unauthorized("E-mail ou senha invalidos.");
    }

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type ?? "Bearer",
    };
  }

  private async loginWithKeycloak(input: LoginInput): Promise<AuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: this.env.KEYCLOAK_CLIENT_ID,
      client_secret: this.env.KEYCLOAK_CLIENT_SECRET,
      username: input.email,
      password: input.password,
    });

    let response: Response;
    try {
      response = await fetch(tokenEndpoint(this.env), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch {
      throw upstreamError("Servico de autenticacao indisponivel.");
    }

    const payload = (await response.json().catch(() => null)) as Partial<AuthTokenResponse> | null;

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
    const providerUser =
      activeAuthProvider(this.env) === "supabase"
        ? await this.createOrUpdateSupabaseUser({
            email: input.email,
            password: input.password,
            name: input.name,
            companyName: input.companyName,
            tenantId,
            role: "ADMIN",
          })
        : await this.createKeycloakUser({
            email: input.email,
            password: input.password,
            name: input.name,
            companyName: input.companyName,
            tenantId,
            temporaryPassword: false,
          }).then((user) => ({ ...user, created: true }));

    const profile = await this.upsertTenantAndUser({
      subject: providerUser.id,
      tenantId,
      email: input.email,
      name: input.name,
      companyName: input.companyName,
      role: "ADMIN",
    });

    return {
      userId: profile.userId,
      authUserId: providerUser.id,
      tenantId,
      email: input.email,
      provider: activeAuthProvider(this.env),
    };
  }

  async recoverPassword(input: RecoverPasswordInput) {
    if (activeAuthProvider(this.env) === "supabase") {
      await this.supabase.auth
        .resetPasswordForEmail(input.email, {
          redirectTo: this.env.SUPABASE_AUTH_CALLBACK_URL,
        })
        .catch(() => undefined);

      return { delivered: true };
    }

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

    if (activeAuthProvider(this.env) === "supabase") {
      const providerUser = await this.createOrUpdateSupabaseUser({
        email: input.email,
        password: input.password,
        name: input.name,
        companyName: input.companyName,
        tenantId,
        role: "ADMIN",
      });

      const profile = await this.upsertTenantAndUser({
        subject: providerUser.id,
        tenantId,
        email: input.email,
        name: input.name,
        companyName: input.companyName,
        role: "ADMIN",
      });

      return {
        userId: profile.userId,
        authUserId: providerUser.id,
        tenantId,
        created: providerUser.created,
        provider: "supabase",
      };
    }

    const existing = await this.findUserByEmail(input.email);

    if (existing) {
      const profile = await this.upsertTenantAndUser({
        subject: existing.id,
        tenantId,
        email: input.email,
        name: input.name,
        companyName: input.companyName,
        role: "ADMIN",
      });
      return { userId: profile.userId, tenantId, created: false, provider: "keycloak" };
    }

    const adminToken = await this.getAdminToken();
    const keycloakExisting = await this.findKeycloakUser(adminToken, input.email);
    if (keycloakExisting?.id) {
      const profile = await this.upsertTenantAndUser({
        subject: keycloakExisting.id,
        tenantId,
        email: input.email,
        name: input.name,
        companyName: input.companyName,
        role: "ADMIN",
      });
      return { userId: profile.userId, tenantId, created: false, provider: "keycloak" };
    }

    const keycloakUser = await this.createKeycloakUser({
      email: input.email,
      password: input.password,
      name: input.name,
      companyName: input.companyName,
      tenantId,
      temporaryPassword: input.temporaryPassword ?? true,
    });

    const profile = await this.upsertTenantAndUser({
      subject: keycloakUser.id,
      tenantId,
      email: input.email,
      name: input.name,
      companyName: input.companyName,
      role: "ADMIN",
    });

    return { userId: profile.userId, tenantId, created: true, provider: "keycloak" };
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

  private async createOrUpdateSupabaseUser(input: {
    email: string;
    password: string;
    name: string;
    companyName: string;
    tenantId: string;
    role: string;
  }): Promise<ProviderUser> {
    const existing = await this.findSupabaseAuthUser(input.email);
    if (existing) {
      await this.updateSupabaseAuthUser(existing.id, input);
      return { ...existing, created: false };
    }

    const result = await this.supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: {
        tenantId: input.tenantId,
        role: input.role,
      },
      user_metadata: {
        name: input.name,
        companyName: input.companyName,
      },
    });

    if (result.error || !result.data.user?.id) {
      const createdAfterConflict = await this.findSupabaseAuthUser(input.email);
      if (createdAfterConflict) {
        await this.updateSupabaseAuthUser(createdAfterConflict.id, input);
        return { ...createdAfterConflict, created: false };
      }

      throw upstreamError("Supabase Auth nao conseguiu criar o usuario.");
    }

    return {
      id: result.data.user.id,
      email: result.data.user.email ?? input.email,
      created: true,
    };
  }

  private async updateSupabaseAuthUser(
    userId: string,
    input: {
      email: string;
      password: string;
      name: string;
      companyName: string;
      tenantId: string;
      role: string;
    },
  ) {
    const result = await this.supabase.auth.admin.updateUserById(userId, {
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: {
        tenantId: input.tenantId,
        role: input.role,
      },
      user_metadata: {
        name: input.name,
        companyName: input.companyName,
      },
    });

    if (result.error) {
      throw upstreamError("Supabase Auth nao conseguiu atualizar o usuario.");
    }
  }

  private async findSupabaseAuthUser(email: string): Promise<ProviderUser | null> {
    const normalizedEmail = email.toLowerCase();
    const perPage = 1000;

    for (let page = 1; page <= 10; page += 1) {
      const result = await this.supabase.auth.admin.listUsers({ page, perPage });
      if (result.error) throw upstreamError("Supabase Auth nao conseguiu buscar usuarios.");

      const users = result.data.users ?? [];
      const user = users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);
      if (user?.id) {
        return {
          id: user.id,
          email: user.email ?? email,
          created: false,
        };
      }

      if (users.length < perPage) return null;
    }

    return null;
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
  }): Promise<{ userId: string }> {
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

    const existing = await this.findUserByEmail(input.email);
    const payload = {
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      role: input.role,
      permissions: ["*"],
      status: "ACTIVE",
      updatedAt: now,
    };

    if (existing?.id) {
      const user = await this.supabase
        .from("users")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .single();
      assertSupabaseOk(user.error, "atualizar perfil do usuario");
      if (!user.data) throw upstreamError("Supabase nao retornou o perfil atualizado.");
      return { userId: user.data.id };
    }

    const user = await this.supabase
      .from("users")
      .insert({
        id: input.subject,
        ...payload,
        createdAt: now,
      })
      .select("id")
      .single();
    assertSupabaseOk(user.error, "criar perfil do usuario");
    if (!user.data) throw upstreamError("Supabase nao retornou o perfil criado.");
    return { userId: user.data.id };
  }
}
