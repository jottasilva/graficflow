import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { CreateInventoryMovementInput } from "../../http/schemas.js";
import { badRequest, notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { roundMoney } from "../../shared/utils/money.js";

type InventoryRow = {
  id: string;
  tenantId: string;
  quantity: number | string;
  reservedQuantity: number | string;
  availableQuantity: number | string;
};

type InventoryListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

function numeric(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function calculateMovement(row: InventoryRow, input: CreateInventoryMovementInput) {
  const quantityBefore = numeric(row.quantity);
  const reservedBefore = numeric(row.reservedQuantity);
  const movementQuantity = input.quantity;

  let quantityAfter = quantityBefore;
  let reservedAfter = reservedBefore;

  switch (input.type) {
    case "IN":
      quantityAfter += movementQuantity;
      break;
    case "OUT":
    case "LOSS":
      quantityAfter -= movementQuantity;
      break;
    case "ADJUSTMENT":
      quantityAfter = movementQuantity;
      break;
    case "RESERVE":
      reservedAfter += movementQuantity;
      break;
    case "RELEASE":
      reservedAfter -= movementQuantity;
      break;
  }

  if (quantityAfter < 0) {
    throw badRequest("Movimento deixaria o estoque negativo.");
  }

  if (reservedAfter < 0) {
    throw badRequest("Movimento deixaria a reserva negativa.");
  }

  if (reservedAfter > quantityAfter) {
    throw badRequest("Reserva nao pode ser maior que a quantidade em estoque.");
  }

  return {
    quantityBefore,
    quantityAfter: roundMoney(quantityAfter),
    reservedAfter: roundMoney(reservedAfter),
    availableAfter: roundMoney(quantityAfter - reservedAfter),
  };
}

export class InventoryService {
  constructor(private readonly supabase: SupabaseServiceClient) {}

  async list(input: InventoryListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("inventories")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("updatedAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      query = query.ilike("productId", `%${input.search}%`);
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar estoque");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async createMovement(input: CreateInventoryMovementInput, auth: AuthContext) {
    const inventoryResult = await this.supabase
      .from("inventories")
      .select("id,tenantId,quantity,reservedQuantity,availableQuantity")
      .eq("id", input.inventoryId)
      .maybeSingle<InventoryRow>();

    assertSupabaseOk(inventoryResult.error, "buscar estoque");
    if (!inventoryResult.data) throw notFound("Item de estoque nao encontrado.");

    assertTenantAccess(auth, inventoryResult.data.tenantId);

    const movement = calculateMovement(inventoryResult.data, input);
    const now = new Date().toISOString();

    const updateResult = await this.supabase
      .from("inventories")
      .update({
        quantity: movement.quantityAfter,
        reservedQuantity: movement.reservedAfter,
        availableQuantity: movement.availableAfter,
        updatedAt: now,
      })
      .eq("id", input.inventoryId)
      .select("id,tenantId,quantity,reservedQuantity,availableQuantity")
      .single();

    assertSupabaseOk(updateResult.error, "atualizar estoque");

    const insertResult = await this.supabase
      .from("inventory_movements")
      .insert({
        id: randomId("mov"),
        tenantId: inventoryResult.data.tenantId,
        inventoryId: input.inventoryId,
        type: input.type,
        quantity: input.quantity,
        balanceBefore: movement.quantityBefore,
        balanceAfter: movement.quantityAfter,
        reason: input.reason,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        userId: auth.userId,
        createdAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(insertResult.error, "registrar movimento de estoque");

    return {
      inventory: updateResult.data,
      movement: insertResult.data,
    };
  }
}
