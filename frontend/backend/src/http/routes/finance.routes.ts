import type { FastifyInstance } from "fastify";
import { createFinanceEntrySchema, tenantQuerySchema } from "../schemas.js";
import { assertPermission, assertTenantAccess } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";

export function registerFinanceRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  supabase: SupabaseServiceClient,
) {
  app.get("/api/finance", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "finance:read");
    const input = tenantQuerySchema.parse(request.query);
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;
    const result = await supabase
      .from("financial_transactions")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("createdAt", { ascending: false })
      .range(from, to);

    assertSupabaseOk(result.error, "listar financeiro");
    return { data: result.data ?? [], page: input.page, pageSize: input.pageSize, total: result.count ?? 0 };
  });

  app.post("/api/finance", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "finance:write");
    const input = createFinanceEntrySchema.parse(request.body);
    assertTenantAccess(auth, input.tenantId);

    const now = new Date().toISOString();
    const result = await supabase
      .from("financial_transactions")
      .insert({
        id: randomId("fin"),
        tenantId: input.tenantId,
        orderId: input.orderId ?? null,
        quoteId: input.quoteId ?? null,
        label: input.label,
        type: input.type,
        value: input.value,
        due: input.due ?? null,
        status: input.status,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar lancamento financeiro");
    return reply.code(201).send(result.data);
  });
}
