import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createFileSchema,
  tenantQuerySchema,
  updateFileSchema,
} from "../schemas.js";
import { assertPermission, assertTenantAccess } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";

export function registerFilesRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  supabase: SupabaseServiceClient,
) {
  app.get("/api/files", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "files:read");
    const input = tenantQuerySchema.parse(request.query);
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;
    const result = await supabase
      .from("files")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("updatedAt", { ascending: false })
      .range(from, to);

    assertSupabaseOk(result.error, "listar arquivos");
    return { data: result.data ?? [], page: input.page, pageSize: input.pageSize, total: result.count ?? 0 };
  });

  app.post("/api/files", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "files:write");
    const input = createFileSchema.parse(request.body);
    assertTenantAccess(auth, input.tenantId);

    const now = new Date().toISOString();
    const result = await supabase
      .from("files")
      .insert({
        id: randomId("fil"),
        tenantId: input.tenantId,
        name: input.name,
        type: input.type,
        size: input.size ?? null,
        linkedTo: input.linkedTo ?? null,
        url: input.url || null,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar arquivo");
    return reply.code(201).send(result.data);
  });

  app.patch("/api/files/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "files:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateFileSchema.parse(request.body);

    const current = await supabase
      .from("files")
      .select("id,tenantId")
      .eq("id", params.id)
      .maybeSingle<{ id: string; tenantId: string }>();
    assertSupabaseOk(current.error, "buscar arquivo");
    if (!current.data) throw new HttpError(404, "Arquivo nao encontrado.", "NOT_FOUND");
    assertTenantAccess(auth, current.data.tenantId);

    const result = await supabase
      .from("files")
      .update({
        ...input,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar arquivo");
    return result.data;
  });

  app.delete("/api/files/:id", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "files:write");
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const current = await supabase
      .from("files")
      .select("id,tenantId")
      .eq("id", params.id)
      .maybeSingle<{ id: string; tenantId: string }>();
    assertSupabaseOk(current.error, "buscar arquivo");
    if (!current.data) return { id: params.id, deleted: false };
    assertTenantAccess(auth, current.data.tenantId);

    const result = await supabase
      .from("files")
      .delete()
      .eq("id", params.id)
      .select("id")
      .maybeSingle();

    assertSupabaseOk(result.error, "remover arquivo");
    return { id: params.id, deleted: Boolean(result.data) };
  });
}
