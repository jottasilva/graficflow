import type { FastifyInstance } from "fastify";
import {
  createProductionWorkLogSchema,
  createQualityInspectionSchema,
  tenantQuerySchema,
} from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { ProductionService } from "../../modules/production/production.service.js";

export function registerProductionRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  productionService: ProductionService,
) {
  app.get("/api/production/work-logs", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "production:read");
    const input = tenantQuerySchema.parse(request.query);
    return productionService.listWorkLogs(input, auth);
  });

  app.post("/api/production/work-logs", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "production:write");
    const input = createProductionWorkLogSchema.parse(request.body);
    const log = await productionService.createWorkLog(input, auth);
    return reply.code(201).send(log);
  });

  app.get("/api/production/quality-inspections", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "production:read");
    const input = tenantQuerySchema.parse(request.query);
    return productionService.listQualityInspections(input, auth);
  });

  app.post("/api/production/quality-inspections", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "production:write");
    const input = createQualityInspectionSchema.parse(request.body);
    const inspection = await productionService.createQualityInspection(input, auth);
    return reply.code(201).send(inspection);
  });
}
