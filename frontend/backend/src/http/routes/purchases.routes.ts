import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createPurchaseOrderSchema,
  tenantQuerySchema,
  updatePurchaseOrderSchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { PurchasesService } from "../../modules/purchases/purchases.service.js";

export function registerPurchasesRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  purchasesService: PurchasesService,
) {
  app.get("/api/purchase-orders", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "purchases:read");
    const input = tenantQuerySchema.parse(request.query);
    return purchasesService.list(input, auth);
  });

  app.post("/api/purchase-orders", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "purchases:write");
    const input = createPurchaseOrderSchema.parse(request.body);
    const purchase = await purchasesService.create(input, auth);
    return reply.code(201).send(purchase);
  });

  app.patch("/api/purchase-orders/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "purchases:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updatePurchaseOrderSchema.parse(request.body);
    return purchasesService.update(params.id, input, auth);
  });

  app.delete("/api/purchase-orders/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "purchases:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return purchasesService.remove(params.id, auth);
  });
}
