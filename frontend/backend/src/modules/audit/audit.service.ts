import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";

type AuditListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

export type AuditEvent = {
  tenantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

export class AuditService {
  constructor(private readonly supabase: SupabaseServiceClient) {}

  async list(input: AuditListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      query = query.or(
        [
          `action.ilike.%${input.search}%`,
          `entityType.ilike.%${input.search}%`,
          `entityId.ilike.%${input.search}%`,
        ].join(","),
      );
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar auditoria");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async record(event: AuditEvent) {
    const result = await this.supabase.from("audit_logs").insert({
      id: randomId("aud"),
      tenantId: event.tenantId,
      userId: event.userId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      before: event.before ?? null,
      after: event.after ?? null,
      ip: event.ip ?? null,
      userAgent: event.userAgent ?? null,
      createdAt: new Date().toISOString(),
    });

    if (result.error) {
      console.warn("[AuditService] Falha ao registrar auditoria (ignorado):", result.error.message);
    }
  }
}
