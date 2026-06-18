import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createFiscalDocumentSchema,
  tenantQuerySchema,
  updateFiscalDocumentSchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { FiscalService } from "../../modules/fiscal/fiscal.service.js";

export function registerFiscalRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  fiscalService: FiscalService,
) {
  app.get("/api/fiscal-documents", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "fiscal:read");
    const input = tenantQuerySchema.parse(request.query);
    return fiscalService.list(input, auth);
  });

  app.post("/api/fiscal-documents", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "fiscal:write");
    const input = createFiscalDocumentSchema.parse(request.body);
    const document = await fiscalService.create(input, auth);
    return reply.code(201).send(document);
  });

  app.patch("/api/fiscal-documents/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "fiscal:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateFiscalDocumentSchema.parse(request.body);
    return fiscalService.update(params.id, input, auth);
  });

  app.post("/api/fiscal-documents/:id/queue", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "fiscal:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return fiscalService.queue(params.id, auth);
  });
}
