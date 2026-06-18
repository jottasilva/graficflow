import type { FastifyInstance } from "fastify";
import { reportQuerySchema, tenantQuerySchema } from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { AuditService } from "../../modules/audit/audit.service.js";
import type { ReportsService } from "../../modules/reports/reports.service.js";

export function registerReportsRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  reportsService: ReportsService,
  auditService: AuditService,
) {
  app.get("/api/reports/management", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "reports:read");
    const input = reportQuerySchema.parse(request.query);
    return reportsService.management(input, auth);
  });

  app.get("/api/audit-logs", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "audit:read");
    const input = tenantQuerySchema.parse(request.query);
    return auditService.list(input, auth);
  });
}
