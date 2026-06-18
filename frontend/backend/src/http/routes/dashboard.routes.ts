import type { FastifyInstance } from "fastify";
import { tenantQuerySchema } from "../schemas.js";
import { assertPermission } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { GraphqlReadService } from "../../modules/graphql/graphql-read.service.js";

export function registerDashboardRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  graphqlReadService: GraphqlReadService,
) {
  app.get("/api/graphql/dashboard-overview", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "dashboard:read");
    const input = tenantQuerySchema.pick({ tenantId: true }).parse(request.query);
    return graphqlReadService.dashboardOverview(input.tenantId, auth);
  });
}
