import type { AuthContext } from "../../http/middleware/auth.js";
import { assertSectorAccess, assertTenantAccess } from "../../http/middleware/auth.js";
import type { CreateProductionWorkLogInput, CreateQualityInspectionInput } from "../../http/schemas.js";
import { notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import type { AuditService } from "../audit/audit.service.js";

type ProductionListInput = {
  tenantId: string;
  page: number;
  pageSize: number;
};

type OrderItemTenantRow = {
  id: string;
  tenantId: string;
  sectorId: string | null;
  machineId: string | null;
  status: string;
};

const statusByWorkLogType: Partial<Record<CreateProductionWorkLogInput["type"], string>> = {
  START: "IN_PROGRESS",
  RESUME: "IN_PROGRESS",
  PAUSE: "PAUSED",
  FINISH: "DONE",
  REWORK: "REJECTED",
};

export class ProductionService {
  constructor(
    private readonly supabase: SupabaseServiceClient,
    private readonly audit: AuditService,
  ) {}

  async listWorkLogs(input: ProductionListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;
    const result = await this.supabase
      .from("production_work_logs")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("createdAt", { ascending: false })
      .range(from, to);

    assertSupabaseOk(result.error, "listar apontamentos de producao");
    return { data: result.data ?? [], page: input.page, pageSize: input.pageSize, total: result.count ?? 0 };
  }

  async createWorkLog(input: CreateProductionWorkLogInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    const item = await this.getOrderItem(input.orderItemId);
    assertTenantAccess(auth, item.tenantId);
    assertSectorAccess(auth, item.sectorId);
    assertSectorAccess(auth, input.sectorId);

    const now = new Date().toISOString();
    const result = await this.supabase
      .from("production_work_logs")
      .insert({
        id: randomId("wrk"),
        tenantId: input.tenantId,
        orderItemId: input.orderItemId,
        userId: auth.userId,
        machineId: input.machineId ?? item.machineId,
        sectorId: input.sectorId ?? item.sectorId,
        type: input.type,
        quantityGood: input.quantityGood,
        quantityLoss: input.quantityLoss,
        minutes: input.minutes,
        notes: input.notes ?? null,
        metadata: input.metadata,
        createdAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar apontamento de producao");

    const nextStatus = statusByWorkLogType[input.type];
    if (nextStatus) {
      const update = await this.supabase
        .from("order_items")
        .update({
          status: nextStatus,
          startedAt: ["START", "RESUME"].includes(input.type) ? now : undefined,
          finishedAt: input.type === "FINISH" ? now : undefined,
          pausedAt: input.type === "PAUSE" ? now : undefined,
          updatedAt: now,
        })
        .eq("id", input.orderItemId);
      assertSupabaseOk(update.error, "atualizar status por apontamento");
    }

    await this.audit.record({
      tenantId: input.tenantId,
      userId: auth.userId,
      action: "production.work_log.create",
      entityType: "production_work_log",
      entityId: result.data.id,
      after: result.data,
    });

    return result.data;
  }

  async listQualityInspections(input: ProductionListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;
    const result = await this.supabase
      .from("quality_inspections")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("createdAt", { ascending: false })
      .range(from, to);

    assertSupabaseOk(result.error, "listar inspecoes de qualidade");
    return { data: result.data ?? [], page: input.page, pageSize: input.pageSize, total: result.count ?? 0 };
  }

  async createQualityInspection(input: CreateQualityInspectionInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    const item = await this.getOrderItem(input.orderItemId);
    assertTenantAccess(auth, item.tenantId);
    assertSectorAccess(auth, item.sectorId);

    const now = new Date().toISOString();
    const result = await this.supabase
      .from("quality_inspections")
      .insert({
        id: randomId("qci"),
        tenantId: input.tenantId,
        orderItemId: input.orderItemId,
        userId: auth.userId,
        status: input.status,
        checkedQty: input.checkedQty,
        rejectedQty: input.rejectedQty,
        checklist: input.checklist,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar inspecao de qualidade");

    if (input.status !== "APPROVED") {
      const update = await this.supabase
        .from("order_items")
        .update({ status: input.status === "REWORK" ? "REJECTED" : "CANCELED", updatedAt: now })
        .eq("id", input.orderItemId);
      assertSupabaseOk(update.error, "atualizar item por qualidade");
    }

    await this.audit.record({
      tenantId: input.tenantId,
      userId: auth.userId,
      action: "production.quality.create",
      entityType: "quality_inspection",
      entityId: result.data.id,
      after: result.data,
    });

    return result.data;
  }

  private async getOrderItem(id: string): Promise<OrderItemTenantRow> {
    const result = await this.supabase
      .from("order_items")
      .select("id,tenantId,sectorId,machineId,status")
      .eq("id", id)
      .maybeSingle<OrderItemTenantRow>();

    assertSupabaseOk(result.error, "buscar item de pedido");
    if (!result.data) throw notFound("Item de pedido nao encontrado.");
    return result.data;
  }
}
