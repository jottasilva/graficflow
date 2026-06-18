import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createQuoteSchema,
  tenantQuerySchema,
  updateQuoteSchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { QuotesService } from "../../modules/quotes/quotes.service.js";

export function registerQuotesRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  quotesService: QuotesService,
) {
  app.get("/api/quotes", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "quotes:read");
    const input = tenantQuerySchema.parse(request.query);
    return quotesService.list(input, auth);
  });

  app.post("/api/quotes", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "quotes:write");
    const input = createQuoteSchema.parse(request.body);
    const quote = await quotesService.create(input, auth);
    return reply.code(201).send(quote);
  });

  app.patch("/api/quotes/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "quotes:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateQuoteSchema.parse(request.body);
    return quotesService.update(params.id, input, auth);
  });

  app.get("/api/quotes/:id/pdf", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "quotes:read");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const pdf = await quotesService.generatePdf(params.id, auth);
    return reply.header("Content-Type", "application/pdf").send(pdf);
  });
}
