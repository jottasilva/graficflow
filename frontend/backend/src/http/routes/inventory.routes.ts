import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createInventoryMovementSchema,
  tenantQuerySchema,
  updateInventorySchema,
} from "../schemas.js";
import { assertPermission, assertTenantAccess } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import type { InventoryService } from "../../modules/inventory/inventory.service.js";

export function registerInventoryRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  supabase: SupabaseServiceClient,
  inventoryService: InventoryService,
) {
  app.get("/api/inventory", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "inventory:read");
    const input = tenantQuerySchema.parse(request.query);
    return inventoryService.list(input, auth);
  });

  app.post("/api/inventory/movements", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "inventory:write");
    const input = createInventoryMovementSchema.parse(request.body);
    const movement = await inventoryService.createMovement(input, auth);
    return reply.code(201).send(movement);
  });

  app.patch("/api/inventory/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "inventory:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateInventorySchema.parse(request.body);

    const current = await supabase
      .from("inventories")
      .select("id,tenantId,reservedQuantity")
      .eq("id", params.id)
      .maybeSingle<{ id: string; tenantId: string; reservedQuantity: number | string | null }>();
    assertSupabaseOk(current.error, "buscar item de estoque");
    if (!current.data) throw new HttpError(404, "Item de estoque nao encontrado.", "NOT_FOUND");
    assertTenantAccess(auth, current.data.tenantId);

    const quantity = typeof input.quantity === "number" ? input.quantity : undefined;
    const reserved = Number(current.data.reservedQuantity ?? 0);
    const updatePayload: Record<string, unknown> = {
      ...input,
      updatedAt: new Date().toISOString(),
    };
    if ("imageUrl" in input) {
      updatePayload.imageUrl = input.imageUrl || null;
    }
    if (quantity !== undefined) {
      updatePayload.availableQuantity = Math.max(0, quantity - reserved);
    }

    const result = await supabase
      .from("inventories")
      .update(updatePayload)
      .eq("id", params.id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar estoque");
    return result.data;
  });

  app.delete("/api/inventory/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "inventory:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const current = await supabase
      .from("inventories")
      .select("id,tenantId")
      .eq("id", params.id)
      .maybeSingle<{ id: string; tenantId: string }>();
    assertSupabaseOk(current.error, "buscar item de estoque");
    if (!current.data) return { id: params.id, deleted: false };
    assertTenantAccess(auth, current.data.tenantId);

    const result = await supabase
      .from("inventories")
      .delete()
      .eq("id", params.id)
      .select("id")
      .maybeSingle();

    assertSupabaseOk(result.error, "remover item de estoque");
    return { id: params.id, deleted: Boolean(result.data) };
  });
}
