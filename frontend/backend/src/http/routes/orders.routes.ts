import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createOrderSchema,
  moveOrderItemSchema,
  tenantQuerySchema,
  updateOrderSchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { OrdersService } from "../../modules/orders/orders.service.js";

export function registerOrdersRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  ordersService: OrdersService,
) {
  app.get("/api/orders", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "orders:read");
    const input = tenantQuerySchema.parse(request.query);
    return ordersService.list(input, auth);
  });

  app.post("/api/orders", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "orders:write");
    const input = createOrderSchema.parse(request.body);
    const order = await ordersService.create(input, auth);
    return reply.code(201).send(order);
  });

  app.patch("/api/orders/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "orders:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateOrderSchema.parse(request.body);
    return ordersService.update(params.id, input, auth);
  });

  app.get("/api/orders/kanban", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "production:read");
    const input = tenantQuerySchema.pick({ tenantId: true }).parse(request.query);
    return ordersService.kanban(input.tenantId, auth);
  });

  app.patch("/api/order-items/:id/move", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "production:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = moveOrderItemSchema.parse(request.body);
    return ordersService.moveOrderItem(params.id, input, auth);
  });
}
