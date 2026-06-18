import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthProvider } from "../middleware/auth.js";
import { assertPermission, assertTenantAccess } from "../middleware/auth.js";
import type { AuditService } from "../../modules/audit/audit.service.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";

const landingPageQuerySchema = z.object({
  tenantId: z.string().min(1).max(120),
});

const landingPageUpdateSchema = z.object({
  tenantId: z.string().min(1).max(120),
  config: z.record(z.string(), z.unknown()),
});

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function getTenantLandingConfig(supabase: SupabaseServiceClient, tenantId: string) {
  const result = await supabase
    .from("tenants")
    .select("id,metadata,updatedAt")
    .eq("id", tenantId)
    .maybeSingle<{ id: string; metadata: Record<string, unknown> | null; updatedAt: string | null }>();

  assertSupabaseOk(result.error, "buscar configuracao da landing page");

  return {
    tenantId,
    config: metadataObject(result.data?.metadata).landingPageConfig ?? null,
    updatedAt: result.data?.updatedAt ?? null,
  };
}

export function registerLandingRoutes(
  app: FastifyInstance,
  authProvider: AuthProvider,
  supabase: SupabaseServiceClient,
  auditService: AuditService,
) {
  app.get("/public/landing-page", async (request) => {
    const input = landingPageQuerySchema.parse(request.query);
    return getTenantLandingConfig(supabase, input.tenantId);
  });

  app.get("/api/landing-page", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "settings:read");
    const input = landingPageQuerySchema.parse(request.query);
    assertTenantAccess(auth, input.tenantId);
    return getTenantLandingConfig(supabase, input.tenantId);
  });

  app.patch("/api/landing-page", async (request) => {
    const auth = await authProvider.requireAuth(request);
    assertPermission(auth, "settings:write");
    const input = landingPageUpdateSchema.parse(request.body);
    assertTenantAccess(auth, input.tenantId);

    const current = await supabase
      .from("tenants")
      .select("id,name,slug,metadata")
      .eq("id", input.tenantId)
      .maybeSingle<{
        id: string;
        name: string | null;
        slug: string | null;
        metadata: Record<string, unknown> | null;
      }>();

    assertSupabaseOk(current.error, "buscar tenant da landing page");

    const now = new Date().toISOString();
    const metadata = {
      ...metadataObject(current.data?.metadata),
      landingPageConfig: input.config,
    };

    const save = current.data
      ? await supabase
          .from("tenants")
          .update({ metadata, updatedAt: now })
          .eq("id", input.tenantId)
          .select("id,metadata,updatedAt")
          .single()
      : await supabase
          .from("tenants")
          .insert({
            id: input.tenantId,
            name: input.tenantId,
            slug: input.tenantId,
            metadata,
            createdAt: now,
            updatedAt: now,
          })
          .select("id,metadata,updatedAt")
          .single();

    assertSupabaseOk(save.error, "salvar configuracao da landing page");

    await auditService.record({
      tenantId: input.tenantId,
      userId: auth.userId,
      action: "landing_page.update",
      entityType: "tenant",
      entityId: input.tenantId,
      before: current.data?.metadata ?? null,
      after: metadata,
    });

    return {
      tenantId: input.tenantId,
      config: metadata.landingPageConfig,
      updatedAt: (save.data as { updatedAt?: string | null } | null)?.updatedAt ?? now,
    };
  });
}
