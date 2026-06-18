import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSupplierSchema, tenantQuerySchema, updateSupplierSchema } from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { SuppliersService } from "../../modules/suppliers/suppliers.service.js";

export function registerSuppliersRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  suppliersService: SuppliersService,
) {
  app.get("/api/suppliers", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "suppliers:read");
    const input = tenantQuerySchema.parse(request.query);
    return suppliersService.list(input, auth);
  });

  app.post("/api/suppliers", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "suppliers:write");
    const input = createSupplierSchema.parse(request.body);
    const supplier = await suppliersService.create(input, auth);
    return reply.code(201).send(supplier);
  });

  app.patch("/api/suppliers/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "suppliers:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateSupplierSchema.parse(request.body);
    return suppliersService.update(params.id, input, auth);
  });

  app.delete("/api/suppliers/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "suppliers:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return suppliersService.remove(params.id, auth);
  });
}
