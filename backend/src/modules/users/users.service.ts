import type { Env } from "../../config/env.js";
import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { CreateUserInput, UpdateUserInput, UpdateUserPasswordInput } from "../../http/schemas.js";
import { badRequest, forbidden, notFound, upstreamError } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { stripUndefined } from "../../shared/utils/objects.js";

type UserListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

type UserRow = {
  id: string;
  tenantId: string;
  role: string | null;
  permissions: string[] | null;
};

type KeycloakUser = {
  id: string;
  email?: string;
  username?: string;
};

function canManageUsers(auth: AuthContext): boolean {
  return auth.role === "ADMIN" || auth.permissions.includes("*") || auth.permissions.includes("users:write");
}

function keycloakConfigured(env: Env): boolean {
  return Boolean(env.KEYCLOAK_ADMIN_CLIENT_ID && (env.KEYCLOAK_ADMIN_CLIENT_SECRET || env.KEYCLOAK_ADMIN_PASSWORD));
}

function tokenEndpoint(env: Env): string {
  return `${env.KEYCLOAK_ISSUER_URL.replace(/\/$/, "")}/protocol/openid-connect/token`;
}

function keycloakAdminBase(env: Env): string {
  const issuer = new URL(env.KEYCLOAK_ISSUER_URL);
  const match = issuer.pathname.match(/^(.*)\/realms\/([^/]+)\/?$/);
  if (!match) throw badRequest("KEYCLOAK_ISSUER_URL deve apontar para um realm Keycloak.");

  const [, basePath, realm] = match;
  return `${issuer.origin}${basePath === "/" ? "" : basePath}/admin/realms/${realm}`;
}

function userStatus(status?: string | null) {
  return status ?? "ACTIVE";
}

export class UsersService {
  constructor(
    private readonly supabase: SupabaseServiceClient,
    private readonly env: Env,
  ) {}

  async list(input: UserListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    if (!canManageUsers(auth) && !auth.permissions.includes("users:read")) {
      throw forbidden("Usuario sem permissao para listar usuarios.");
    }

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("users")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .is("deletedAt", null)
      .order("name", { ascending: true })
      .range(from, to);

    if (input.search) {
      query = query.or(`name.ilike.%${input.search}%,email.ilike.%${input.search}%`);
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar usuarios");
    const users = result.data ?? [];
    const sectorMap = await this.listUserSectorMap(input.tenantId, users.map((user) => String(user.id)));

    return {
      data: users.map((user) => ({
        ...user,
        type: user.type ?? (user.role === "CLIENT" ? "CLIENT" : user.role === "ADMIN" ? "ADMIN" : "OPERATOR"),
        phone: user.phone ?? "",
        document: user.document ?? "",
        avatarUrl: user.avatarUrl ?? "",
        status: userStatus(user.status),
        sectorIds: sectorMap.get(String(user.id)) ?? [],
      })),
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async create(input: CreateUserInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    if (!canManageUsers(auth)) throw forbidden("Usuario sem permissao para criar usuarios.");

    const keycloakUser = await this.createKeycloakUserIfConfigured(input);
    const now = new Date().toISOString();
    const userId = keycloakUser?.id ?? randomId("usr");

    const result = await this.supabase
      .from("users")
      .insert({
        id: userId,
        tenantId: input.tenantId,
        type: input.type,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        document: input.document ?? null,
        avatarUrl: input.avatarUrl || null,
        role: input.role,
        permissions: input.permissions,
        status: input.status,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar usuario");
    await this.replaceSectorLinks(input.tenantId, userId, input.sectorIds);
    return { ...result.data, sectorIds: input.sectorIds };
  }

  async update(id: string, input: UpdateUserInput, auth: AuthContext) {
    const current = await this.getUserTenant(id);
    assertTenantAccess(auth, current.tenantId);
    if (!canManageUsers(auth)) throw forbidden("Usuario sem permissao para atualizar usuarios.");

    const result = await this.supabase
      .from("users")
      .update(
        stripUndefined({
          type: input.type,
          name: input.name,
          email: input.email,
          phone: input.phone,
          document: input.document,
          avatarUrl: input.avatarUrl,
          role: input.role,
          permissions: input.permissions,
          status: input.status,
          metadata: input.metadata,
          updatedAt: new Date().toISOString(),
        }),
      )
      .eq("id", id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar usuario");
    if (input.sectorIds) await this.replaceSectorLinks(current.tenantId, id, input.sectorIds);
    const sectorIds = input.sectorIds ?? (await this.listUserSectorMap(current.tenantId, [id])).get(id) ?? [];
    return { ...result.data, sectorIds };
  }

  async updatePassword(id: string, input: UpdateUserPasswordInput, auth: AuthContext) {
    const current = await this.getUserTenant(id);
    assertTenantAccess(auth, current.tenantId);
    if (!canManageUsers(auth)) throw forbidden("Usuario sem permissao para trocar senha.");

    if (!keycloakConfigured(this.env)) {
      if (this.env.NODE_ENV === "production") {
        throw badRequest("Credenciais administrativas do Keycloak nao configuradas.");
      }

      return { id, passwordUpdated: false, provider: "dev" };
    }

    const adminToken = await this.getAdminToken();
    const response = await fetch(`${keycloakAdminBase(this.env)}/users/${encodeURIComponent(id)}/reset-password`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "password",
        value: input.password,
        temporary: input.temporary,
      }),
    });

    if (!response.ok) {
      throw upstreamError("Keycloak nao conseguiu trocar a senha.", { status: response.status });
    }

    return { id, passwordUpdated: true, provider: "keycloak" };
  }

  async remove(id: string, auth: AuthContext) {
    const current = await this.getUserTenant(id);
    assertTenantAccess(auth, current.tenantId);
    if (!canManageUsers(auth)) throw forbidden("Usuario sem permissao para remover usuarios.");

    const result = await this.supabase
      .from("users")
      .update({ status: "INACTIVE", deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    assertSupabaseOk(result.error, "remover usuario");
    if (!result.data) throw notFound("Usuario nao encontrado.");
    return { id, deleted: true };
  }

  private async getUserTenant(id: string): Promise<UserRow> {
    const result = await this.supabase
      .from("users")
      .select("id,tenantId,role,permissions")
      .eq("id", id)
      .is("deletedAt", null)
      .maybeSingle<UserRow>();

    assertSupabaseOk(result.error, "buscar usuario");
    if (!result.data) throw notFound("Usuario nao encontrado.");
    return result.data;
  }

  private async listUserSectorMap(tenantId: string, userIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (!userIds.length) return map;

    const result = await this.supabase
      .from("user_sector_permissions")
      .select("userId,sectorId")
      .eq("tenantId", tenantId)
      .in("userId", userIds);

    if (result.error?.code === "42P01") return map;
    assertSupabaseOk(result.error, "listar permissoes de setores");

    for (const row of result.data ?? []) {
      const userId = String(row.userId);
      const current = map.get(userId) ?? [];
      current.push(String(row.sectorId));
      map.set(userId, current);
    }

    return map;
  }

  private async replaceSectorLinks(tenantId: string, userId: string, sectorIds: string[]) {
    const remove = await this.supabase
      .from("user_sector_permissions")
      .delete()
      .eq("tenantId", tenantId)
      .eq("userId", userId);

    if (remove.error?.code === "42P01") return;
    assertSupabaseOk(remove.error, "limpar setores do usuario");

    if (!sectorIds.length) return;

    const now = new Date().toISOString();
    const insert = await this.supabase.from("user_sector_permissions").insert(
      sectorIds.map((sectorId) => ({
        id: randomId("usp"),
        tenantId,
        userId,
        sectorId,
        canRead: true,
        canWrite: true,
        createdAt: now,
        updatedAt: now,
      })),
    );

    assertSupabaseOk(insert.error, "vincular setores ao usuario");
  }

  private async createKeycloakUserIfConfigured(input: CreateUserInput): Promise<KeycloakUser | null> {
    if (!keycloakConfigured(this.env)) return null;

    const adminToken = await this.getAdminToken();
    const existing = await this.findKeycloakUser(adminToken, input.email);
    if (existing) return existing;

    const response = await fetch(`${keycloakAdminBase(this.env)}/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: input.email,
        email: input.email,
        firstName: input.name,
        enabled: input.status !== "INACTIVE" && input.status !== "SUSPENDED",
        requiredActions: input.password ? [] : ["UPDATE_PASSWORD"],
        attributes: {
          tenantId: [input.tenantId],
          userType: [input.type],
        },
        credentials: input.password
          ? [{ type: "password", value: input.password, temporary: true }]
          : undefined,
      }),
    });

    if (!response.ok) {
      throw upstreamError("Keycloak nao conseguiu criar o usuario.", { status: response.status });
    }

    const id = response.headers.get("location")?.split("/").pop();
    if (id) return { id, email: input.email };

    return this.findKeycloakUser(adminToken, input.email);
  }

  private async getAdminToken(): Promise<string> {
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
      throw upstreamError("Nao foi possivel obter token administrativo do Keycloak.", { status: response.status });
    }

    return payload.access_token;
  }

  private async findKeycloakUser(adminToken: string, email: string): Promise<KeycloakUser | null> {
    const params = new URLSearchParams({ email, exact: "true", max: "1" });
    const response = await fetch(`${keycloakAdminBase(this.env)}/users?${params.toString()}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (!response.ok) {
      throw upstreamError("Keycloak nao conseguiu buscar usuario.", { status: response.status });
    }

    const users = (await response.json()) as KeycloakUser[];
    return users[0] ?? null;
  }
}
