import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { z } from "zod";
import { createCorsOriginMatcher } from "./config/cors.js";
import { loadEnv } from "./config/env.js";
import { createAuthProvider } from "./http/middleware/auth.js";
import {
  registerAuthRoutes,
  registerClientsRoutes,
  registerDashboardRoutes,
  registerFilesRoutes,
  registerFinanceRoutes,
  registerFiscalRoutes,
  registerInventoryRoutes,
  registerLandingRoutes,
  registerMachinesRoutes,
  registerNotificationsRoutes,
  registerOrdersRoutes,
  registerPaymentsRoutes,
  registerProductionRoutes,
  registerPublicOrdersRoutes,
  registerPublicQuotesRoutes,
  registerPurchasesRoutes,
  registerProductsRoutes,
  registerQuotesRoutes,
  registerReportsRoutes,
  registerSectorsRoutes,
  registerSuppliersRoutes,
  registerUploadRoutes,
  registerUsersRoutes,
} from "./http/routes/index.js";
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

const env = loadEnv();
const UPLOAD_MAX_BYTES = env.UPLOAD_MAX_MB * 1024 * 1024;
const UPLOAD_MAX_LABEL = `${env.UPLOAD_MAX_MB}MB`;

const app = Fastify({ logger: true, bodyLimit: UPLOAD_MAX_BYTES + 512_000 });
const supabase = createSupabaseServiceClient(env);
const authProvider = createAuthProvider(env, supabase);
const auditService = new AuditService(supabase);
const authService = new AuthService(env, supabase);
const clientsService = new ClientsService(supabase);
const fiscalService = new FiscalService(supabase, auditService);
const graphqlReadService = new GraphqlReadService(supabase);
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

// ---------------------------------------------------------------------------
// Infraestrutura: plugins, CORS e tratamento de erros
// ---------------------------------------------------------------------------
await app.register(helmet);
await app.register(cookie);
await app.register(multipart, {
  limits: {
    fileSize: UPLOAD_MAX_BYTES,
    files: 1,
  },
});

app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
  try {
    const raw = typeof body === "string" ? body : String(body);
    done(null, JSON.parse(raw));
  } catch (err) {
    done(err as Error, undefined);
  }
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

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------
app.get("/healthz", async () => ({ ok: true }));
app.get("/readyz", async () => ({ ok: true, supabaseUrl: env.SUPABASE_URL }));

// ---------------------------------------------------------------------------
// Registro das rotas por domínio
// ---------------------------------------------------------------------------
registerAuthRoutes(app, env, authProvider, authService);
registerLandingRoutes(app, authProvider, supabase, auditService);
registerUploadRoutes(app, env, authProvider, supabase);
registerDashboardRoutes(app, authProvider, graphqlReadService);
registerClientsRoutes(app, authProvider, clientsService);
registerUsersRoutes(app, authProvider, usersService);
registerProductsRoutes(app, authProvider, productsService);
registerInventoryRoutes(app, authProvider, supabase, inventoryService);
registerFinanceRoutes(app, authProvider, supabase);
registerSuppliersRoutes(app, authProvider, suppliersService);
registerPurchasesRoutes(app, authProvider, purchasesService);
registerPaymentsRoutes(app, authProvider, paymentsService);
registerFiscalRoutes(app, authProvider, fiscalService);
registerProductionRoutes(app, authProvider, productionService);
registerReportsRoutes(app, authProvider, reportsService, auditService);
registerFilesRoutes(app, authProvider, supabase);
registerNotificationsRoutes(app, authProvider, supabase);
registerSectorsRoutes(app, authProvider, sectorsService);
registerMachinesRoutes(app, authProvider, machinesService);
registerOrdersRoutes(app, authProvider, ordersService);
registerPublicOrdersRoutes(app, ordersService);
registerQuotesRoutes(app, authProvider, quotesService);
registerPublicQuotesRoutes(app, quotesService);

export { app };

export async function startServer() {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

if (process.env.VERCEL !== "1") {
  await startServer();
}
