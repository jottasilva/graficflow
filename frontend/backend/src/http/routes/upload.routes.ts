import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { assertPermission, assertTenantAccess } from "../middleware/auth.js";
import type { AuthProvider } from "../middleware/auth.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";

const uploadMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
]);

const uploadQuerySchema = z.object({
  tenantId: z.string().min(1).max(120),
  scope: z
    .enum(["clients", "users", "products", "inventory", "files", "orders"])
    .default("files"),
});

const uploadPermissionByScope: Record<z.infer<typeof uploadQuerySchema>["scope"], string> = {
  clients: "clients:write",
  users: "users:write",
  products: "products:write",
  inventory: "inventory:write",
  files: "files:write",
  orders: "orders:write",
};

let uploadBucketReady = false;

function safeFileName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return normalized || "arquivo";
}

async function ensureUploadBucket(supabase: SupabaseServiceClient, env: Env, uploadMaxBytes: number) {
  if (uploadBucketReady) return;

  const buckets = await supabase.storage.listBuckets();
  assertSupabaseOk(buckets.error, "listar buckets de storage");

  const exists = (buckets.data ?? []).some((bucket) => bucket.name === env.UPLOAD_STORAGE_BUCKET);
  if (!exists) {
    const create = await supabase.storage.createBucket(env.UPLOAD_STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: uploadMaxBytes,
      allowedMimeTypes: Array.from(uploadMimeTypes),
    });
    assertSupabaseOk(create.error, "criar bucket de uploads");
  }

  uploadBucketReady = true;
}

export function registerUploadRoutes(
  app: FastifyInstance,
  env: Env,
  authProvider: AuthProvider,
  supabase: SupabaseServiceClient,
) {
  const uploadMaxBytes = env.UPLOAD_MAX_MB * 1024 * 1024;
  const uploadMaxLabel = `${env.UPLOAD_MAX_MB}MB`;

  app.post("/api/uploads", async (request, reply) => {
    const auth = await authProvider.requireAuth(request);
    const input = uploadQuerySchema.parse(request.query);
    assertTenantAccess(auth, input.tenantId);
    assertPermission(auth, uploadPermissionByScope[input.scope]);

    const file = await request.file();
    if (!file) {
      throw new HttpError(400, "Envie um arquivo no campo file.", "INVALID_UPLOAD");
    }

    if (!uploadMimeTypes.has(file.mimetype)) {
      throw new HttpError(400, "Tipo de arquivo nao permitido.", "INVALID_UPLOAD_TYPE", {
        mimetype: file.mimetype,
      });
    }

    const buffer = await file.toBuffer();
    if (!buffer.length || buffer.length > uploadMaxBytes) {
      throw new HttpError(
        400,
        `Arquivo vazio ou acima do limite de ${uploadMaxLabel}.`,
        "INVALID_UPLOAD_SIZE",
      );
    }

    await ensureUploadBucket(supabase, env, uploadMaxBytes);

    const objectPath = [
      input.tenantId,
      input.scope,
      `${Date.now()}-${randomId("upl")}-${safeFileName(file.filename)}`,
    ].join("/");
    const upload = await supabase.storage.from(env.UPLOAD_STORAGE_BUCKET).upload(objectPath, buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    assertSupabaseOk(upload.error, "enviar arquivo para storage");

    const publicUrl = supabase.storage.from(env.UPLOAD_STORAGE_BUCKET).getPublicUrl(objectPath);

    return reply.code(201).send({
      bucket: env.UPLOAD_STORAGE_BUCKET,
      path: objectPath,
      url: publicUrl.data.publicUrl,
      name: file.filename,
      size: buffer.length,
      contentType: file.mimetype,
    });
  });
}
