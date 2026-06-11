import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { z } from "zod";
import { createCorsOriginMatcher } from "./config/cors.js";
import { loadEnv } from "./config/env.js";
import {
  acceptOrderSchema,
  acceptQuoteSchema,
  createFiscalDocumentSchema,
  createFileSchema,
  createFinanceEntrySchema,
  createClientSchema,
  createInventoryMovementSchema,
  createMachineSchema,
  createMaintenanceTicketSchema,
  createOrderSchema,
  createPaymentTransactionSchema,
  createProductSchema,
  createProductionWorkLogSchema,
  createPurchaseOrderSchema,
  createQualityInspectionSchema,
  createQuoteSchema,
  createSectorSchema,
  createSupplierSchema,
  createUserSchema,
  loginSchema,
  moveOrderItemSchema,
  recoverPasswordSchema,
  reportQuerySchema,
  registerSchema,
  tenantQuerySchema,
  updateClientSchema,
  updateFiscalDocumentSchema,
  updateFileSchema,
  updateInventorySchema,
  updateMachineSchema,
  updateMaintenanceTicketSchema,
  updateNotificationSchema,
  updateOrderSchema,
  updatePaymentTransactionSchema,
  updateProductSchema,
  updatePurchaseOrderSchema,
  updateQuoteSchema,
  updateSectorSchema,
  updateSupplierSchema,
  updateUserPasswordSchema,
  updateUserSchema,
} from "./http/schemas.js";
import { assertPermission, assertTenantAccess, createAuthProvider } from "./http/middleware/auth.js";
import { AuditService } from "./modules/audit/audit.service.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { ClientsService } from "./modules/clients/clients.service.js";
import { FiscalService } from "./modules/fiscal/fiscal.service.js";
import { GraphqlReadService } from "./modules/graphql/graphql-read.service.js";
import { InventoryService } from "./modules/inventory/inventory.service.js";
import { MachinesService } from "./modules/machines/machines.service.js";
import { OrdersService } from "./modules/orders/orders.service.js";
import { PaymentsService } from "./modules/payments/payments.service.js";
import { ProductsService } from "./modules/products/products.service.js";
import { ProductionService } from "./modules/production/production.service.js";
import { PurchasesService } from "./modules/purchases/purchases.service.js";
import { QuotesService } from "./modules/quotes/quotes.service.js";
import { ReportsService } from "./modules/reports/reports.service.js";
import { SectorsService } from "./modules/sectors/sectors.service.js";
import { SuppliersService } from "./modules/suppliers/suppliers.service.js";
import { UsersService } from "./modules/users/users.service.js";
import { HttpError } from "./shared/errors/http-error.js";
import { createSupabaseServiceClient } from "./shared/supabase/client.js";
import { assertSupabaseOk } from "./shared/supabase/result.js";
import { randomId } from "./shared/utils/ids.js";

const env = loadEnv();
const UPLOAD_MAX_BYTES = env.UPLOAD_MAX_MB * 1024 * 1024;
const UPLOAD_MAX_LABEL = `${env.UPLOAD_MAX_MB}MB`;
const uploadMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
]);
const app = Fastify({ logger: true, bodyLimit: UPLOAD_MAX_BYTES + 512_000 });
const supabase = createSupabaseServiceClient(env);
const authProvider = createAuthProvider(env, supabase);
const auditService = new AuditService(supabase);
const authService = new AuthService(env, supabase);
const clientsService = new ClientsService(supabase);
const fiscalService = new FiscalService(supabase, auditService);
const graphqlReadService = new GraphqlReadService(env);
const inventoryService = new InventoryService(supabase);
const machinesService = new MachinesService(supabase);
const ordersService = new OrdersService(supabase, env);
const paymentsService = new PaymentsService(supabase, auditService);
const productsService = new ProductsService(supabase);
const productionService = new ProductionService(supabase, auditService);
const purchasesService = new PurchasesService(supabase, auditService);
const quotesService = new QuotesService(supabase, env);
const reportsService = new ReportsService(supabase);
const sectorsService = new SectorsService(supabase);
const suppliersService = new SuppliersService(supabase, auditService);
const usersService = new UsersService(supabase, env);

await app.register(helmet);
await app.register(cookie);
await app.register(multipart, {
  limits: {
    fileSize: UPLOAD_MAX_BYTES,
    files: 1,
  },
});

const isAllowedCorsOrigin = createCorsOriginMatcher(env);

await app.register(cors, {
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  origin(origin, callback) {
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true);
      return;
    }

    app.log.warn({ origin }, "Blocked CORS origin");
    callback(null, false);
  },
});

function cookieOptions(maxAge?: number) {
  return {
    path: "/",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    domain: env.AUTH_COOKIE_DOMAIN,
    maxAge,
  };
}

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

async function ensureUploadBucket() {
  if (uploadBucketReady) return;

  const buckets = await supabase.storage.listBuckets();
  assertSupabaseOk(buckets.error, "listar buckets de storage");

  const exists = (buckets.data ?? []).some((bucket) => bucket.name === env.UPLOAD_STORAGE_BUCKET);
  if (!exists) {
    const create = await supabase.storage.createBucket(env.UPLOAD_STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: UPLOAD_MAX_BYTES,
      allowedMimeTypes: Array.from(uploadMimeTypes),
    });
    assertSupabaseOk(create.error, "criar bucket de uploads");
  }

  uploadBucketReady = true;
}

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({
      code: "VALIDATION_ERROR",
      message: "Entrada invalida.",
      issues: error.issues,
    });
  }

  if (error instanceof HttpError) {
    return reply.code(error.statusCode).send({
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  const parsedError = error as { statusCode?: number; code?: string; message?: string };
  if (
    parsedError.statusCode === 413 ||
    parsedError.code === "FST_REQ_FILE_TOO_LARGE" ||
    parsedError.code === "FST_ERR_CTP_BODY_TOO_LARGE" ||
    /file too large|request.*too large/i.test(parsedError.message ?? "")
  ) {
    return reply.code(413).send({
      code: "UPLOAD_TOO_LARGE",
      message: `Arquivo acima do limite de ${UPLOAD_MAX_LABEL}.`,
      limitMb: env.UPLOAD_MAX_MB,
    });
  }

  const httpStatus = typeof parsedError.statusCode === "number" ? parsedError.statusCode : 500;
  if (httpStatus >= 400 && httpStatus < 500) {
    return reply.code(httpStatus).send({
      code: parsedError.code ?? "BAD_REQUEST",
      message: parsedError.message ?? "Requisicao invalida.",
    });
  }

  app.log.error(error);
  return reply.code(500).send({
    code: "INTERNAL_ERROR",
    message: "Erro interno.",
  });
});

app.get("/healthz", async () => ({ ok: true }));
app.get("/readyz", async () => ({ ok: true, supabaseUrl: env.SUPABASE_URL }));

app.post("/api/auth/login", async (request, reply) => {
  const input = loginSchema.parse(request.body);
  const tokens = await authService.login(input);
  const auth = await authProvider.verifyToken(tokens.access_token);
  const accessMaxAge = input.remember ? tokens.expires_in ?? 3600 : undefined;
  const refreshMaxAge = input.remember ? tokens.refresh_expires_in : undefined;

  reply.setCookie(env.AUTH_COOKIE_NAME, tokens.access_token, cookieOptions(accessMaxAge));
  if (tokens.refresh_token) {
    reply.setCookie(env.AUTH_REFRESH_COOKIE_NAME, tokens.refresh_token, cookieOptions(refreshMaxAge));
  }

  return {
    authenticated: true,
    expiresIn: tokens.expires_in ?? null,
    user: authService.profile(auth).user,
  };
});

app.post("/api/auth/logout", async (_request, reply) => {
  reply.clearCookie(env.AUTH_COOKIE_NAME, cookieOptions());
  reply.clearCookie(env.AUTH_REFRESH_COOKIE_NAME, cookieOptions());
  return { authenticated: false };
});

app.get("/api/auth/session", async (request) => {
  const auth = await authProvider.requireAuth(request);
  return authService.profile(auth);
});

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
  if (!buffer.length || buffer.length > UPLOAD_MAX_BYTES) {
    throw new HttpError(400, `Arquivo vazio ou acima do limite de ${UPLOAD_MAX_LABEL}.`, "INVALID_UPLOAD_SIZE");
  }

  await ensureUploadBucket();

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

app.post("/api/auth/register", async (request, reply) => {
  const input = registerSchema.parse(request.body);
  const user = await authService.register(input);
  return reply.code(201).send(user);
});

app.post("/api/auth/recover", async (request) => {
  const input = recoverPasswordSchema.parse(request.body);
  return authService.recoverPassword(input);
});

app.get("/api/clients", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "clients:read");
  const input = tenantQuerySchema.parse(request.query);
  return clientsService.list(input, auth);
});

app.get("/api/graphql/dashboard-overview", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "dashboard:read");
  const input = tenantQuerySchema.pick({ tenantId: true }).parse(request.query);
  return graphqlReadService.dashboardOverview(input.tenantId, auth);
});

app.post("/api/clients", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "clients:write");
  const input = createClientSchema.parse(request.body);
  const client = await clientsService.create(input, auth);
  return reply.code(201).send(client);
});

app.patch("/api/clients/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "clients:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updateClientSchema.parse(request.body);
  return clientsService.update(params.id, input, auth);
});

app.delete("/api/clients/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "clients:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  return clientsService.remove(params.id, auth);
});

app.get("/api/users", async (request) => {
  const auth = await authProvider.requireAuth(request);
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

app.get("/api/products", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "products:read");
  const input = tenantQuerySchema.parse(request.query);
  return productsService.list(input, auth);
});

app.post("/api/products", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "products:write");
  const input = createProductSchema.parse(request.body);
  const product = await productsService.create(input, auth);
  return reply.code(201).send(product);
});

app.patch("/api/products/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "products:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updateProductSchema.parse(request.body);
  return productsService.update(params.id, input, auth);
});

app.delete("/api/products/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "products:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  return productsService.remove(params.id, auth);
});

app.get("/api/inventory", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "inventory:read");
  const input = tenantQuerySchema.parse(request.query);
  return inventoryService.list(input, auth);
});

app.post("/api/inventory/movements", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "inventory:write");
  const input = createInventoryMovementSchema.parse(request.body);
  const movement = await inventoryService.createMovement(input, auth);
  return reply.code(201).send(movement);
});

app.patch("/api/inventory/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "inventory:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updateInventorySchema.parse(request.body);

  const current = await supabase
    .from("inventories")
    .select("id,tenantId,reservedQuantity")
    .eq("id", params.id)
    .maybeSingle<{ id: string; tenantId: string; reservedQuantity: number | string | null }>();
  assertSupabaseOk(current.error, "buscar item de estoque");
  if (!current.data) throw new HttpError(404, "Item de estoque nao encontrado.", "NOT_FOUND");
  assertTenantAccess(auth, current.data.tenantId);

  const quantity = typeof input.quantity === "number" ? input.quantity : undefined;
  const reserved = Number(current.data.reservedQuantity ?? 0);
  const updatePayload: Record<string, unknown> = {
    ...input,
    updatedAt: new Date().toISOString(),
  };
  if ("imageUrl" in input) {
    updatePayload.imageUrl = input.imageUrl || null;
  }
  if (quantity !== undefined) {
    updatePayload.availableQuantity = Math.max(0, quantity - reserved);
  }

  const result = await supabase
    .from("inventories")
    .update(updatePayload)
    .eq("id", params.id)
    .select("*")
    .single();

  assertSupabaseOk(result.error, "atualizar estoque");
  return result.data;
});

app.delete("/api/inventory/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "inventory:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);

  const current = await supabase
    .from("inventories")
    .select("id,tenantId")
    .eq("id", params.id)
    .maybeSingle<{ id: string; tenantId: string }>();
  assertSupabaseOk(current.error, "buscar item de estoque");
  if (!current.data) return { id: params.id, deleted: false };
  assertTenantAccess(auth, current.data.tenantId);

  const result = await supabase
    .from("inventories")
    .delete()
    .eq("id", params.id)
    .select("id")
    .maybeSingle();

  assertSupabaseOk(result.error, "remover item de estoque");
  return { id: params.id, deleted: Boolean(result.data) };
});

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

app.get("/api/suppliers", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "suppliers:read");
  const input = tenantQuerySchema.parse(request.query);
  return suppliersService.list(input, auth);
});

app.post("/api/suppliers", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "suppliers:write");
  const input = createSupplierSchema.parse(request.body);
  const supplier = await suppliersService.create(input, auth);
  return reply.code(201).send(supplier);
});

app.patch("/api/suppliers/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "suppliers:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updateSupplierSchema.parse(request.body);
  return suppliersService.update(params.id, input, auth);
});

app.delete("/api/suppliers/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "suppliers:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  return suppliersService.remove(params.id, auth);
});

app.get("/api/purchase-orders", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "purchases:read");
  const input = tenantQuerySchema.parse(request.query);
  return purchasesService.list(input, auth);
});

app.post("/api/purchase-orders", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "purchases:write");
  const input = createPurchaseOrderSchema.parse(request.body);
  const purchase = await purchasesService.create(input, auth);
  return reply.code(201).send(purchase);
});

app.patch("/api/purchase-orders/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "purchases:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updatePurchaseOrderSchema.parse(request.body);
  return purchasesService.update(params.id, input, auth);
});

app.delete("/api/purchase-orders/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "purchases:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  return purchasesService.remove(params.id, auth);
});

app.get("/api/payments", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "payments:read");
  const input = tenantQuerySchema.parse(request.query);
  return paymentsService.list(input, auth);
});

app.post("/api/payments", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "payments:write");
  const input = createPaymentTransactionSchema.parse(request.body);
  const payment = await paymentsService.create(input, auth);
  return reply.code(201).send(payment);
});

app.patch("/api/payments/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "payments:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updatePaymentTransactionSchema.parse(request.body);
  return paymentsService.update(params.id, input, auth);
});

app.get("/api/fiscal-documents", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "fiscal:read");
  const input = tenantQuerySchema.parse(request.query);
  return fiscalService.list(input, auth);
});

app.post("/api/fiscal-documents", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "fiscal:write");
  const input = createFiscalDocumentSchema.parse(request.body);
  const document = await fiscalService.create(input, auth);
  return reply.code(201).send(document);
});

app.patch("/api/fiscal-documents/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "fiscal:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updateFiscalDocumentSchema.parse(request.body);
  return fiscalService.update(params.id, input, auth);
});

app.post("/api/fiscal-documents/:id/queue", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "fiscal:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  return fiscalService.queue(params.id, auth);
});

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

app.get("/api/notifications", async (request) => {
  const auth = await authProvider.requireAuth(request);
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

app.get("/api/sectors", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "sectors:read");
  const input = tenantQuerySchema.parse(request.query);
  return sectorsService.list(input, auth);
});

app.post("/api/sectors", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "sectors:write");
  const input = createSectorSchema.parse(request.body);
  const sector = await sectorsService.create(input, auth);
  return reply.code(201).send(sector);
});

app.patch("/api/sectors/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "sectors:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updateSectorSchema.parse(request.body);
  return sectorsService.update(params.id, input, auth);
});

app.delete("/api/sectors/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "sectors:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  return sectorsService.remove(params.id, auth);
});

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

app.get("/api/orders", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "orders:read");
  const input = tenantQuerySchema.parse(request.query);
  return ordersService.list(input, auth);
});

app.post("/api/orders", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "orders:write");
  const input = createOrderSchema.parse(request.body);
  const order = await ordersService.create(input, auth);
  return reply.code(201).send(order);
});

app.patch("/api/orders/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "orders:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updateOrderSchema.parse(request.body);
  return ordersService.update(params.id, input, auth);
});

app.get("/api/orders/kanban", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "production:read");
  const input = tenantQuerySchema.pick({ tenantId: true }).parse(request.query);
  return ordersService.kanban(input.tenantId, auth);
});

app.patch("/api/order-items/:id/move", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "production:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = moveOrderItemSchema.parse(request.body);
  return ordersService.moveOrderItem(params.id, input, auth);
});

app.get("/public/orders/:orderId", async (request) => {
  const input = z.object({
    orderId: z.string().min(1),
    token: z.string().min(32).max(240),
  }).parse({
    ...(request.params as object),
    ...(request.query as object),
  });

  return ordersService.getPublicOrder(input.orderId, input.token);
});

app.post("/public/orders/:orderId/accept", async (request, reply) => {
  const input = acceptOrderSchema.parse({
    ...(request.body as object),
    orderId: (request.params as { orderId: string }).orderId,
  });
  const acceptance = await ordersService.accept(input);
  return reply.code(200).send(acceptance);
});

app.get("/api/quotes", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "quotes:read");
  const input = tenantQuerySchema.parse(request.query);
  return quotesService.list(input, auth);
});

app.post("/api/quotes", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "quotes:write");
  const input = createQuoteSchema.parse(request.body);
  const quote = await quotesService.create(input, auth);
  return reply.code(201).send(quote);
});

app.patch("/api/quotes/:id", async (request) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "quotes:write");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const input = updateQuoteSchema.parse(request.body);
  return quotesService.update(params.id, input, auth);
});

app.get("/api/quotes/:id/pdf", async (request, reply) => {
  const auth = await authProvider.requireAuth(request);
  assertPermission(auth, "quotes:read");
  const params = z.object({ id: z.string().min(1) }).parse(request.params);
  const pdf = await quotesService.generatePdf(params.id, auth);
  return reply.header("Content-Type", "application/pdf").send(pdf);
});

app.get("/public/quotes/:quoteId", async (request) => {
  const input = z.object({
    quoteId: z.string().min(1),
    token: z.string().min(32).max(240),
  }).parse({
    ...(request.params as object),
    ...(request.query as object),
  });

  return quotesService.getPublicQuote(input.quoteId, input.token);
});

app.post("/public/quotes/:quoteId/accept", async (request, reply) => {
  const input = acceptQuoteSchema.parse({
    ...(request.body as object),
    quoteId: (request.params as { quoteId: string }).quoteId,
  });
  const acceptance = await quotesService.accept(input);
  return reply.code(200).send(acceptance);
});

export { app };

export async function startServer() {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

if (process.env.VERCEL !== "1") {
  await startServer();
}
