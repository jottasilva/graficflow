import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { CreatePurchaseOrderInput, UpdatePurchaseOrderInput } from "../../http/schemas.js";
import { badRequest, notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { documentNumber, randomId } from "../../shared/utils/ids.js";
import { roundMoney } from "../../shared/utils/money.js";
import { stripUndefined } from "../../shared/utils/objects.js";
import type { AuditService } from "../audit/audit.service.js";

type PurchaseListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

function lineTotal(item: CreatePurchaseOrderInput["items"][number]): number {
  return roundMoney(item.quantity * item.unitCost - item.discount);
}

function purchaseTotals(input: CreatePurchaseOrderInput) {
  const subtotal = roundMoney(input.items.reduce((sum, item) => sum + lineTotal(item), 0));
  const total = roundMoney(subtotal - input.discountAmount + input.shippingAmount + input.taxAmount);
  if (total < 0) throw badRequest("Total da compra nao pode ser negativo.");

  return {
    subtotal,
    total,
    remainingAmount: total,
  };
}

export class PurchasesService {
  constructor(
    private readonly supabase: SupabaseServiceClient,
    private readonly audit: AuditService,
  ) {}

  async list(input: PurchaseListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("purchase_orders")
      .select("*,purchase_order_items(*)", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      query = query.ilike("number", `%${input.search.trim()}%`);
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar compras");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async create(input: CreatePurchaseOrderInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    await this.assertSupplier(input.supplierId, input.tenantId);

    const now = new Date().toISOString();
    const purchaseOrderId = randomId("po");
    const totals = purchaseTotals(input);

    const purchase = await this.supabase
      .from("purchase_orders")
      .insert({
        id: purchaseOrderId,
        tenantId: input.tenantId,
        supplierId: input.supplierId,
        userId: auth.userId,
        number: documentNumber("OC"),
        status: input.status,
        paymentStatus: "PENDING",
        subtotal: totals.subtotal,
        discountAmount: input.discountAmount,
        shippingAmount: input.shippingAmount,
        taxAmount: input.taxAmount,
        total: totals.total,
        paidAmount: 0,
        remainingAmount: totals.remainingAmount,
        expectedDeliveryAt: input.expectedDeliveryAt ?? null,
        notes: input.notes ?? null,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(purchase.error, "criar ordem de compra");

    const items = input.items.map((item) => ({
      id: randomId("poi"),
      tenantId: input.tenantId,
      purchaseOrderId,
      productId: item.productId ?? null,
      inventoryId: item.inventoryId ?? null,
      description: item.description,
      quantity: item.quantity,
      unitCost: item.unitCost,
      discount: item.discount,
      total: lineTotal(item),
      metadata: item.metadata,
      createdAt: now,
      updatedAt: now,
    }));

    const itemResult = await this.supabase.from("purchase_order_items").insert(items).select("*");
    assertSupabaseOk(itemResult.error, "criar itens da compra");

    const created = {
      ...purchase.data,
      purchase_order_items: itemResult.data ?? [],
    };

    await this.audit.record({
      tenantId: input.tenantId,
      userId: auth.userId,
      action: "purchase_order.create",
      entityType: "purchase_order",
      entityId: purchaseOrderId,
      after: created,
    });

    return created;
  }

  async update(id: string, input: UpdatePurchaseOrderInput, auth: AuthContext) {
    const current = await this.getTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const paymentPatch =
      typeof input.paidAmount === "number"
        ? {
            paidAmount: input.paidAmount,
            remainingAmount: Math.max(0, Number(current.total ?? 0) - input.paidAmount),
            paymentStatus:
              input.paidAmount <= 0 ? "PENDING" : input.paidAmount >= Number(current.total ?? 0) ? "PAID" : "PARTIAL",
          }
        : {};

    const result = await this.supabase
      .from("purchase_orders")
      .update(
        stripUndefined({
          ...input,
          ...paymentPatch,
          updatedAt: new Date().toISOString(),
        }),
      )
      .eq("id", id)
      .select("*,purchase_order_items(*)")
      .single();

    assertSupabaseOk(result.error, "atualizar ordem de compra");

    await this.audit.record({
      tenantId: current.tenantId,
      userId: auth.userId,
      action: "purchase_order.update",
      entityType: "purchase_order",
      entityId: id,
      before: current,
      after: result.data,
    });

    return result.data;
  }

  async remove(id: string, auth: AuthContext) {
    const current = await this.getTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase
      .from("purchase_orders")
      .update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "CANCELED" })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    assertSupabaseOk(result.error, "remover ordem de compra");
    if (!result.data) throw notFound("Ordem de compra nao encontrada.");

    await this.audit.record({
      tenantId: current.tenantId,
      userId: auth.userId,
      action: "purchase_order.delete",
      entityType: "purchase_order",
      entityId: id,
      before: current,
    });

    return { id, deleted: true };
  }

  private async assertSupplier(supplierId: string, tenantId: string) {
    const result = await this.supabase
      .from("suppliers")
      .select("id,tenantId,status")
      .eq("id", supplierId)
      .is("deletedAt", null)
      .maybeSingle<{ id: string; tenantId: string; status: string }>();

    assertSupabaseOk(result.error, "buscar fornecedor da compra");
    if (!result.data) throw notFound("Fornecedor nao encontrado.");
    if (result.data.tenantId !== tenantId) throw notFound("Fornecedor nao encontrado.");
    if (result.data.status === "BLOCKED") throw badRequest("Fornecedor bloqueado para compras.");
  }

  private async getTenant(id: string): Promise<Record<string, unknown> & { id: string; tenantId: string; total: number | string }> {
    const result = await this.supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", id)
      .is("deletedAt", null)
      .maybeSingle();

    assertSupabaseOk(result.error, "buscar ordem de compra");
    if (!result.data) throw notFound("Ordem de compra nao encontrada.");
    return result.data as Record<string, unknown> & { id: string; tenantId: string; total: number | string };
  }
}
