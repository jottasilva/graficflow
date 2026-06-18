import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createUserSchema,
  tenantQuerySchema,
  updateUserPasswordSchema,
  updateUserSchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { UsersService } from "../../modules/users/users.service.js";

export function registerUsersRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  usersService: UsersService,
) {
  app.get("/api/users", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "users:read");
    const input = tenantQuerySchema.parse(request.query);
    return usersService.list(input, auth);
  });

  app.post("/api/users", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    const input = createUserSchema.parse(request.body);
    const user = await usersService.create(input, auth);
    return reply.code(201).send(user);
  });

  app.patch("/api/users/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateUserSchema.parse(request.body);
    return usersService.update(params.id, input, auth);
  });

  app.patch("/api/users/:id/password", async (request) => {
    const auth = await authProvider.requireAuth(request);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateUserPasswordSchema.parse(request.body);
    return usersService.updatePassword(params.id, input, auth);
  });

  app.delete("/api/users/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return usersService.remove(params.id, auth);
  });
}
