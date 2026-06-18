import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createClientSchema, updateClientSchema } from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import { tenantQuerySchema } from "../schemas.js";
import type { ClientsService } from "../../modules/clients/clients.service.js";

export function registerClientsRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  clientsService: ClientsService,
) {
  app.get("/api/clients", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "clients:read");
    const input = tenantQuerySchema.parse(request.query);
    return clientsService.list(input, auth);
  });

  app.post("/api/clients", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "clients:write");
    const input = createClientSchema.parse(request.body);
    const client = await clientsService.create(input, auth);
    return reply.code(201).send(client);
  });

  app.patch("/api/clients/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "clients:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateClientSchema.parse(request.body);
    return clientsService.update(params.id, input, auth);
  });

  app.delete("/api/clients/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "clients:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return clientsService.remove(params.id, auth);
  });
}
