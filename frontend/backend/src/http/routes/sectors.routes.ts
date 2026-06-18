import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createSectorSchema,
  tenantQuerySchema,
  updateSectorSchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { SectorsService } from "../../modules/sectors/sectors.service.js";

export function registerSectorsRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  sectorsService: SectorsService,
) {
  app.get("/api/sectors", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "sectors:read");
    const input = tenantQuerySchema.parse(request.query);
    return sectorsService.list(input, auth);
  });

  app.post("/api/sectors", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "sectors:write");
    const input = createSectorSchema.parse(request.body);
    const sector = await sectorsService.create(input, auth);
    return reply.code(201).send(sector);
  });

  app.patch("/api/sectors/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "sectors:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateSectorSchema.parse(request.body);
    return sectorsService.update(params.id, input, auth);
  });

  app.delete("/api/sectors/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "sectors:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return sectorsService.remove(params.id, auth);
  });
}
