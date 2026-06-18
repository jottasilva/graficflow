import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createMachineSchema,
  createMaintenanceTicketSchema,
  tenantQuerySchema,
  updateMachineSchema,
  updateMaintenanceTicketSchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { MachinesService } from "../../modules/machines/machines.service.js";

export function registerMachinesRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  machinesService: MachinesService,
) {
  app.get("/api/machines", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "machines:read");
    const input = tenantQuerySchema.parse(request.query);
    return machinesService.list(input, auth);
  });

  app.post("/api/machines", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "machines:write");
    const input = createMachineSchema.parse(request.body);
    const machine = await machinesService.create(input, auth);
    return reply.code(201).send(machine);
  });

  app.patch("/api/machines/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "machines:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateMachineSchema.parse(request.body);
    return machinesService.update(params.id, input, auth);
  });

  app.delete("/api/machines/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "machines:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return machinesService.remove(params.id, auth);
  });

  app.get("/api/maintenance-tickets", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "machines:read");
    const input = tenantQuerySchema.pick({ tenantId: true }).parse(request.query);
    return machinesService.listMaintenanceTickets(input.tenantId, auth);
  });

  app.post("/api/maintenance-tickets", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "machines:write");
    const input = createMaintenanceTicketSchema.parse(request.body);
    const ticket = await machinesService.createMaintenanceTicket(input, auth);
    return reply.code(201).send(ticket);
  });

  app.patch("/api/maintenance-tickets/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "machines:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateMaintenanceTicketSchema.parse(request.body);
    return machinesService.updateMaintenanceTicket(params.id, input, auth);
  });

  app.delete("/api/maintenance-tickets/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "machines:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    return machinesService.removeMaintenanceTicket(params.id, auth);
  });
}
