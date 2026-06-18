import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { CreateFiscalDocumentInput, UpdateFiscalDocumentInput } from "../../http/schemas.js";
import { badRequest, notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { stripUndefined } from "../../shared/utils/objects.js";
import type { AuditService } from "../audit/audit.service.js";

type FiscalListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

type OrderFiscalSource = {
  id: string;
  tenantId: string;
  customerId: string;
  number: string;
  total: number | string;
  order_items?: Array<Record<string, unknown>>;
  customers?: Record<string, unknown> | null;
};

export class FiscalService {
  constructor(
    private readonly supabase: SupabaseServiceClient,
    private readonly audit: AuditService,
  ) {}

  async list(input: FiscalListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("fiscal_documents")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      query = query.or(
        [`number.ilike.%${input.search}%`, `accessKey.ilike.%${input.search}%`, `provider.ilike.%${input.search}%`].join(","),
      );
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar documentos fiscais");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async create(input: CreateFiscalDocumentInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const order = input.orderId ? await this.getOrderSource(input.orderId, input.tenantId) : null;
    const customerId = input.customerId ?? order?.customerId ?? null;
    if (!customerId && input.type !== "NFSE") {
      throw badRequest("Documento fiscal de venda precisa de cliente ou pedido vinculado.");
    }

    const now = new Date().toISOString();
    const payload = {
      source: "graphflow",
      order: order
        ? {
            id: order.id,
            number: order.number,
            total: order.total,
            customer: order.customers ?? null,
            items: order.order_items ?? [],
          }
        : null,
      ...input.payload,
    };

    const result = await this.supabase
      .from("fiscal_documents")
      .insert({
        id: randomId("fis"),
        tenantId: input.tenantId,
        orderId: input.orderId ?? null,
        customerId,
        type: input.type,
        operation: input.operation,
        environment: input.environment,
        status: "DRAFT",
        provider: input.provider ?? null,
        series: input.series ?? null,
        number: input.number ?? null,
        payload,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar documento fiscal");

    await this.audit.record({
      tenantId: input.tenantId,
      userId: auth.userId,
      action: "fiscal_document.create",
      entityType: "fiscal_document",
      entityId: result.data.id,
      after: result.data,
    });

    return result.data;
  }

  async update(id: string, input: UpdateFiscalDocumentInput, auth: AuthContext) {
    const current = await this.getTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase
      .from("fiscal_documents")
      .update(stripUndefined({ ...input, updatedAt: new Date().toISOString() }))
      .eq("id", id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar documento fiscal");

    await this.audit.record({
      tenantId: current.tenantId,
      userId: auth.userId,
      action: "fiscal_document.update",
      entityType: "fiscal_document",
      entityId: id,
      before: current,
      after: result.data,
    });

    return result.data;
  }

  async queue(id: string, auth: AuthContext) {
    return this.update(id, { status: "QUEUED" }, auth);
  }

  private async getOrderSource(orderId: string, tenantId: string): Promise<OrderFiscalSource> {
    const result = await this.supabase
      .from("orders")
      .select("id,tenantId,customerId,number,total,customers(*),order_items(*)")
      .eq("id", orderId)
      .eq("tenantId", tenantId)
      .maybeSingle<OrderFiscalSource>();

    assertSupabaseOk(result.error, "buscar pedido para documento fiscal");
    if (!result.data) throw notFound("Pedido nao encontrado para documento fiscal.");
    return result.data;
  }

  private async getTenant(id: string): Promise<Record<string, unknown> & { id: string; tenantId: string }> {
    const result = await this.supabase.from("fiscal_documents").select("*").eq("id", id).maybeSingle();
    assertSupabaseOk(result.error, "buscar documento fiscal");
    if (!result.data) throw notFound("Documento fiscal nao encontrado.");
    return result.data as Record<string, unknown> & { id: string; tenantId: string };
  }
}
