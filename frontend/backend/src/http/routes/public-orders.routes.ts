import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { acceptOrderSchema } from "../schemas.js";
import type { OrdersService } from "../../modules/orders/orders.service.js";

export function registerPublicOrdersRoutes(
  app: FastifyInstance,
  ordersService: OrdersService,
) {
  app.get("/public/orders/:orderId", async (request) => {
    const input = z
      .object({
        orderId: z.string().min(1),
        token: z.string().min(32).max(240),
      })
      .parse({
        ...(request.params as object),
        ...(request.query as object),
      });

    return ordersService.getPublicOrder(input.orderId, input.token);
  });

  app.post("/public/orders/:orderId/accept", async (request, reply) => {
    const input = acceptOrderSchema.parse({
      ...(request.body as object),
      orderId: (request.params as { orderId: string }).orderId,
    });
    const acceptance = await ordersService.accept(input);
    return reply.code(200).send(acceptance);
  });
}
