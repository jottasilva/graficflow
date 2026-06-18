import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createPaymentTransactionSchema,
  tenantQuerySchema,
  updatePaymentTransactionSchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { PaymentsService } from "../../modules/payments/payments.service.js";

export function registerPaymentsRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  paymentsService: PaymentsService,
) {
  app.get("/api/payments", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "payments:read");
    const input = tenantQuerySchema.parse(request.query);
    return paymentsService.list(input, auth);
  });

  app.post("/api/payments", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "payments:write");
    const input = createPaymentTransactionSchema.parse(request.body);
    const payment = await paymentsService.create(input, auth);
    return reply.code(201).send(payment);
  });

  app.patch("/api/payments/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "payments:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updatePaymentTransactionSchema.parse(request.body);
    return paymentsService.update(params.id, input, auth);
  });
}
