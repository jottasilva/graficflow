import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createProductSchema,
  tenantQuerySchema,
  updateProductSchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { ProductsService } from "../../modules/products/products.service.js";

export function registerProductsRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  productsService: ProductsService,
) {
  app.get("/api/products", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "products:read");
    const input = tenantQuerySchema.parse(request.query);
    return productsService.list(input, auth);
  });

  app.post("/api/products", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "products:write");
    const input = createProductSchema.parse(request.body);
    const product = await productsService.create(input, auth);
    return reply.code(201).send(product);
  });

  app.patch("/api/products/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "products:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateProductSchema.parse(request.body);
    return productsService.update(params.id, input, auth);
  });

  app.delete("/api/products/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "products:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return productsService.remove(params.id, auth);
  });
}
