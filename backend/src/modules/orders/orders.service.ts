import { createHash } from "node:crypto";
import type { Env } from "../../config/env.js";
import type { AuthContext } from "../../http/middleware/auth.js";
import { assertSectorAccess, assertTenantAccess, hasPermission } from "../../http/middleware/auth.js";
import type {
  AcceptOrderInput,
  CreateOrderInput,
  MoveOrderItemInput,
  UpdateOrderInput,
} from "../../http/schemas.js";
import { conflict, gone, notFound, unauthorized } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { DOCUMENT_NUMBER_MAX_ATTEMPTS, documentNumber, isDocumentNumberConflict, randomId, randomToken } from "../../shared/utils/ids.js";
import { lineTotal, subtotal } from "../../shared/utils/money.js";
import { stripUndefined } from "../../shared/utils/objects.js";

type OrderListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

type OrderItemRow = {
  id: string;
  tenantId: string;
  status: string;
  position: number;
  sectorId: string | null;
  machineId: string | null;
  startedAt: string | null;
};

type UsageLogRow = {
  id: string;
  startTime: string;
};

type PublicOrderTokenRow = {
  id: string;
  orderId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function statusPatch(current: OrderItemRow, input: MoveOrderItemInput) {
  const now = new Date().toISOString();

  return stripUndefined({
    status: input.toStatus,
    position: input.toPosition,
    sectorId: input.sectorId,
    machineId: input.machineId,
    assignedUserId: input.assignedUserId,
    startedAt: input.toStatus === "IN_PROGRESS" && !current.startedAt ? now : undefined,
    finishedAt: input.toStatus === "DONE" ? now : undefined,
    pausedAt: input.toStatus === "PAUSED" ? now : undefined,
    updatedAt: now,
  });
}

export class OrdersService {
  constructor(
    private readonly supabase: SupabaseServiceClient,
    private readonly env: Env,
  ) {}

  async list(input: OrderListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("orders")
      .select("*,order_items(*)", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      query = query.ilike("number", `%${input.search}%`);
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar pedidos");
    const data = result.data ?? [];
    const visibleData = hasPermission(auth, "*")
      ? data
      : data.filter((order) =>
          ((order.order_items ?? []) as Array<{ sectorId?: string | null }>).some((item) =>
            item.sectorId ? auth.sectorIds.includes(item.sectorId) : false,
          ),
        );

    return {
      data: visibleData,
      page: input.page,
      pageSize: input.pageSize,
      total: hasPermission(auth, "*") ? result.count ?? 0 : visibleData.length,
    };
  }

  async create(input: CreateOrderInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    for (const item of input.items) {
      assertSectorAccess(auth, item.sectorId);
    }
    const now = new Date().toISOString();
    const orderId = randomId("ord");
    const total = subtotal(input.items);
    const rawToken = randomToken();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    let orderData: Record<string, unknown> | null = null;

    for (let attempt = 0; attempt < DOCUMENT_NUMBER_MAX_ATTEMPTS; attempt += 1) {
      const orderResult = await this.supabase
        .from("orders")
        .insert({
          id: orderId,
          tenantId: input.tenantId,
          customerId: input.customerId,
          userId: auth.userId,
          quoteId: input.quoteId ?? null,
          number: documentNumber("PED"),
          status: "CONFIRMED",
          paymentStatus: "PENDING",
          productionStatus: "WAITING",
          subtotal: total,
          discountAmount: 0,
          taxAmount: 0,
          shippingAmount: 0,
          total,
          paidAmount: 0,
          remainingAmount: total,
          notes: input.notes ?? null,
          internalNotes: input.internalNotes ?? null,
          expectedDeliveryAt: input.expectedDeliveryAt ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .select("*")
        .single();

      if (isDocumentNumberConflict(orderResult.error)) {
        continue;
      }

      assertSupabaseOk(orderResult.error, "criar pedido");
      orderData = orderResult.data as Record<string, unknown>;
      break;
    }

    if (!orderData) {
      throw conflict("Nao foi possivel gerar um numero unico para o pedido. Tente novamente.");
    }

    const items = input.items.map((item, index) => ({
      id: randomId("itm"),
      tenantId: input.tenantId,
      orderId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: lineTotal(item),
      status: "PENDING",
      position: index,
      priority: item.priority,
      dueDate: item.dueDate ?? null,
      assignedUserId: item.assignedUserId ?? null,
      sectorId: item.sectorId ?? null,
      machineId: item.machineId ?? null,
      createdAt: now,
      updatedAt: now,
    }));

    try {
      const itemResult = await this.supabase.from("order_items").insert(items).select("*");
      assertSupabaseOk(itemResult.error, "criar itens do pedido");

      const tokenResult = await this.supabase
        .from("order_public_tokens")
        .insert({
          id: randomId("otk"),
          tenantId: input.tenantId,
          orderId,
          tokenHash: this.hashToken(rawToken),
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .select("id,expiresAt")
        .single();
      assertSupabaseOk(tokenResult.error, "criar link publico do pedido");

      const financeResult = await this.supabase
        .from("financial_transactions")
        .insert({
          id: randomId("fin"),
          tenantId: input.tenantId,
          orderId,
          quoteId: input.quoteId ?? null,
          label: `Receber pedido ${String(orderData.number ?? orderId)}`,
          type: "receivable",
          value: total,
          due: input.expectedDeliveryAt?.slice(0, 10) ?? null,
          status: "Pendente",
          metadata: { source: "order.create", orderNumber: orderData.number ?? null },
          createdAt: now,
          updatedAt: now,
        })
        .select("id")
        .single();
      assertSupabaseOk(financeResult.error, "criar recebivel do pedido");

      return {
        ...orderData,
        order_items: itemResult.data ?? [],
        publicLink: this.publicOrderLink(orderId, rawToken),
        publicLinkExpiresAt: expiresAt,
      };
    } catch (error) {
      await Promise.allSettled([
        this.supabase.from("financial_transactions").delete().eq("orderId", orderId),
        this.supabase.from("order_public_tokens").delete().eq("orderId", orderId),
        this.supabase.from("order_items").delete().eq("orderId", orderId),
        this.supabase.from("orders").delete().eq("id", orderId),
      ]);
      throw error;
    }
  }

  async update(id: string, input: UpdateOrderInput, auth: AuthContext) {
    const current = await this.getOrderTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase
      .from("orders")
      .update(stripUndefined({ ...input, updatedAt: new Date().toISOString() }))
      .eq("id", id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar pedido");
    return result.data;
  }

  async getPublicOrder(orderId: string, token: string) {
    const publicToken = await this.verifyPublicToken(orderId, token, { allowAccepted: true });

    const order = await this.supabase
      .from("orders")
      .select("*,order_items(*)")
      .eq("id", publicToken.orderId)
      .maybeSingle();

    assertSupabaseOk(order.error, "buscar pedido publico");
    if (!order.data) throw notFound("Pedido nao encontrado.");

    const [customer, responsibleUser, tenant] = await Promise.all([
      this.supabase
        .from("customers")
        .select("id,name,companyName,email,phone,whatsapp,document,documentType,addressStreet,addressNumber,addressComplement,addressDistrict,addressCity,addressState,addressZip")
        .eq("id", order.data.customerId)
        .maybeSingle(),
      order.data.userId
        ? this.supabase.from("users").select("id,name,email,phone").eq("id", order.data.userId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      this.supabase.from("tenants").select("id,name,slug").eq("id", publicToken.tenantId).maybeSingle(),
    ]);
    assertSupabaseOk(customer.error, "buscar cliente do pedido publico");
    assertSupabaseOk(responsibleUser.error, "buscar responsavel do pedido publico");
    assertSupabaseOk(tenant.error, "buscar empresa do pedido publico");

    return {
      ...order.data,
      customer: customer.data ?? null,
      responsibleUser: responsibleUser.data ?? null,
      tenant: tenant.data ?? null,
      publicLinkExpiresAt: publicToken.expiresAt,
      publicLinkAcceptedAt: publicToken.acceptedAt,
    };
  }

  async accept(input: AcceptOrderInput) {
    const publicToken = await this.verifyPublicToken(input.orderId, input.token, { allowAccepted: true });
    const current = await this.supabase
      .from("orders")
      .select("*")
      .eq("id", publicToken.orderId)
      .maybeSingle();

    assertSupabaseOk(current.error, "buscar pedido para aceite");
    if (!current.data) throw notFound("Pedido nao encontrado.");

    if (publicToken.acceptedAt) {
      return {
        accepted: true,
        acceptedAt: publicToken.acceptedAt,
        order: current.data,
      };
    }

    const now = new Date().toISOString();
    const metadata = {
      ...metadataObject(current.data.metadata),
      acceptedAt: now,
      acceptedByName: input.acceptedByName,
      acceptedByEmail: input.acceptedByEmail,
      acceptedIp: input.acceptedIp ?? null,
    };

    const order = await this.supabase
      .from("orders")
      .update({
        metadata,
        updatedAt: now,
      })
      .eq("id", publicToken.orderId)
      .select("*")
      .single();

    assertSupabaseOk(order.error, "aceitar pedido");

    const tokenUpdate = await this.supabase
      .from("order_public_tokens")
      .update({ acceptedAt: now, updatedAt: now })
      .eq("id", publicToken.id);
    assertSupabaseOk(tokenUpdate.error, "registrar aceite do link de pedido");

    return {
      accepted: true,
      acceptedAt: now,
      order: order.data,
    };
  }

  async kanban(tenantId: string, auth: AuthContext) {
    assertTenantAccess(auth, tenantId);

    let sectorsQuery = this.supabase
      .from("sectors")
      .select("id,name,color,kanbanOrder")
      .eq("tenantId", tenantId)
      .order("kanbanOrder", { ascending: true });

    if (!hasPermission(auth, "*")) {
      if (auth.sectorIds.length === 0) {
        return { stages: [], cards: [] };
      }

      sectorsQuery = sectorsQuery.in("id", auth.sectorIds);
    }

    const sectors = await sectorsQuery;
    assertSupabaseOk(sectors.error, "listar etapas do kanban");

    let itemsQuery = this.supabase
      .from("order_items")
      .select("id,orderId,description,status,position,priority,dueDate,sectorId,machineId,orders(customerId,number)")
      .eq("tenantId", tenantId)
      .order("position", { ascending: true });

    if (!hasPermission(auth, "*")) {
      itemsQuery = itemsQuery.in("sectorId", auth.sectorIds);
    }

    const items = await itemsQuery;
    assertSupabaseOk(items.error, "listar cards do kanban");

    return {
      stages: sectors.data ?? [],
      cards: items.data ?? [],
    };
  }

  async moveOrderItem(id: string, input: MoveOrderItemInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const current = await this.supabase
      .from("order_items")
      .select("id,tenantId,status,position,sectorId,machineId,startedAt")
      .eq("id", id)
      .maybeSingle<OrderItemRow>();

    assertSupabaseOk(current.error, "buscar item de pedido");
    if (!current.data) throw notFound("Item de pedido nao encontrado.");
    assertTenantAccess(auth, current.data.tenantId);
    assertSectorAccess(auth, current.data.sectorId);
    assertSectorAccess(auth, input.sectorId);

    const patch = statusPatch(current.data, input);
    const result = await this.supabase
      .from("order_items")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    assertSupabaseOk(result.error, "mover item de pedido");

    await this.supabase.from("order_item_logs").insert({
      id: randomId("log"),
      tenantId: input.tenantId,
      orderItemId: id,
      userId: auth.userId,
      fromStatus: current.data.status,
      toStatus: input.toStatus,
      fromPosition: current.data.position,
      toPosition: input.toPosition,
      note: input.note ?? null,
      createdAt: new Date().toISOString(),
    });

    await this.syncMachineUsage(current.data, input, auth);
    return result.data;
  }

  private async getOrderTenant(id: string): Promise<{ id: string; tenantId: string }> {
    const result = await this.supabase
      .from("orders")
      .select("id,tenantId")
      .eq("id", id)
      .maybeSingle<{ id: string; tenantId: string }>();

    assertSupabaseOk(result.error, "buscar pedido");
    if (!result.data) throw notFound("Pedido nao encontrado.");
    return result.data;
  }

  private async verifyPublicToken(
    orderId: string,
    token: string,
    options: { allowAccepted?: boolean } = {},
  ): Promise<PublicOrderTokenRow> {
    const result = await this.supabase
      .from("order_public_tokens")
      .select("*")
      .eq("orderId", orderId)
      .eq("tokenHash", this.hashToken(token))
      .is("revokedAt", null)
      .maybeSingle<PublicOrderTokenRow>();

    assertSupabaseOk(result.error, "validar link publico do pedido");
    if (!result.data) throw unauthorized("Link de pedido invalido.");

    if (result.data.acceptedAt && !options.allowAccepted) {
      throw gone("Pedido ja foi aceito por este link.");
    }

    if (!result.data.acceptedAt && Date.parse(result.data.expiresAt) < Date.now()) {
      throw gone("Link de pedido expirado.");
    }

    return result.data;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(`${token}.${this.env.QUOTE_PUBLIC_TOKEN_PEPPER}`).digest("hex");
  }

  private publicOrderLink(orderId: string, token: string): string {
    const base = this.env.PUBLIC_APP_URL.replace(/\/$/, "");
    return `${base}/pedidos/${orderId}?token=${encodeURIComponent(token)}`;
  }

  private async syncMachineUsage(current: OrderItemRow, input: MoveOrderItemInput, auth: AuthContext) {
    const machineId = input.machineId ?? current.machineId;
    if (!machineId) return;

    const now = new Date().toISOString();

    if (input.toStatus === "IN_PROGRESS") {
      const existing = await this.supabase
        .from("machine_usage_logs")
        .select("id")
        .eq("orderItemId", current.id)
        .is("endTime", null)
        .limit(1);
      assertSupabaseOk(existing.error, "validar uso aberto da maquina");

      if ((existing.data ?? []).length === 0) {
        const opened = await this.supabase.from("machine_usage_logs").insert({
          id: randomId("use"),
          tenantId: input.tenantId,
          machineId,
          userId: auth.userId,
          orderItemId: current.id,
          startTime: now,
          notes: input.note ?? null,
        });
        assertSupabaseOk(opened.error, "abrir uso da maquina");
      }

      return;
    }

    if (current.status === "IN_PROGRESS") {
      const openUsage = await this.supabase
        .from("machine_usage_logs")
        .select("id,startTime")
        .eq("orderItemId", current.id)
        .is("endTime", null)
        .order("startTime", { ascending: false })
        .limit(1);
      assertSupabaseOk(openUsage.error, "buscar uso aberto da maquina");

      const row = (openUsage.data ?? [])[0] as UsageLogRow | undefined;
      if (!row) return;

      const duration = Math.max(0, Math.round((Date.parse(now) - Date.parse(row.startTime)) / 60000));
      const closed = await this.supabase
        .from("machine_usage_logs")
        .update({ endTime: now, duration })
        .eq("id", row.id);
      assertSupabaseOk(closed.error, "fechar uso da maquina");
    }
  }
}
