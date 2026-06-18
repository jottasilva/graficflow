import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  tenantQuerySchema,
  updateNotificationSchema,
} from "../schemas.js";
import { assertPermission, assertTenantAccess } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";

export function registerNotificationsRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  supabase: SupabaseServiceClient,
) {
  app.get("/api/notifications", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "notifications:read");
    const input = tenantQuerySchema.parse(request.query);
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;
    const result = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("createdAt", { ascending: false })
      .range(from, to);

    assertSupabaseOk(result.error, "listar notificacoes");
    return { data: result.data ?? [], page: input.page, pageSize: input.pageSize, total: result.count ?? 0 };
  });

  app.patch("/api/notifications/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "notifications:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const query = tenantQuerySchema.pick({ tenantId: true }).parse(request.query);
    const input = updateNotificationSchema.parse(request.body);
    assertTenantAccess(auth, query.tenantId);

    const result = await supabase
      .from("notifications")
      .update(input)
      .eq("id", params.id)
      .eq("tenantId", query.tenantId)
      .select("*")
      .maybeSingle();

    assertSupabaseOk(result.error, "atualizar notificacao");
    return result.data ?? { id: params.id, updated: false };
  });

  app.delete("/api/notifications/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "notifications:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const query = tenantQuerySchema.pick({ tenantId: true }).parse(request.query);
    assertTenantAccess(auth, query.tenantId);

    const result = await supabase
      .from("notifications")
      .delete()
      .eq("id", params.id)
      .eq("tenantId", query.tenantId)
      .select("id")
      .maybeSingle();

    assertSupabaseOk(result.error, "remover notificacao");
    return { id: params.id, deleted: Boolean(result.data) };
  });
}
