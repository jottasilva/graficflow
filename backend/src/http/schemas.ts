import { z } from "zod";

export const idSchema = z.string().min(1).max(120);
export const uuidSchema = z.string().uuid();
export const moneySchema = z.coerce.number().nonnegative().multipleOf(0.01);
export const quantitySchema = z.coerce.number().positive();
export const optionalTextSchema = z.string().trim().max(2000).optional();
export const nonEmptyTextSchema = z.string().trim().min(1).max(2000);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const tenantQuerySchema = paginationSchema.extend({
  tenantId: idSchema,
  search: z.string().trim().max(120).optional(),
});

export const authEmailSchema = z.string().trim().email().max(180).transform((value) => value.toLowerCase());
export const strongPasswordSchema = z
  .string()
  .min(8, "Senha deve ter no minimo 8 caracteres.")
  .max(128)
  .regex(/[A-Za-z]/, "Senha deve conter letras.")
  .regex(/[0-9]/, "Senha deve conter numeros.");

export const loginSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1).max(128),
  remember: z.boolean().default(true),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    companyName: z.string().trim().min(2).max(160),
    email: authEmailSchema,
    password: strongPasswordSchema,
    passwordConfirmation: z.string().min(1).max(128),
  })
  .superRefine((input, context) => {
    if (input.password !== input.passwordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "As senhas nao conferem.",
      });
    }
  });

export const recoverPasswordSchema = z.object({
  email: authEmailSchema,
});

const clientSchemaBase = z.object({
  tenantId: idSchema,
  personType: z.enum(["PF", "PJ"]),
  documentType: z.enum(["CPF", "CNPJ"]),
  document: z.string().trim().min(11).max(18),
  name: z.string().trim().min(2).max(160),
  companyName: z.string().trim().max(160).optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(30).optional(),
  whatsapp: z.string().trim().min(8).max(30).optional(),
  avatarUrl: z.string().trim().url().optional().or(z.literal("")),
  addressZip: z.string().trim().max(12).optional(),
  addressStreet: z.string().trim().max(160).optional(),
  addressNumber: z.string().trim().max(30).optional(),
  addressComplement: z.string().trim().max(120).optional(),
  addressDistrict: z.string().trim().max(120).optional(),
  addressCity: z.string().trim().max(120).optional(),
  addressState: z.string().trim().length(2).optional().or(z.literal("")),
  addressCountry: z.string().trim().length(2).default("BR"),
  notes: optionalTextSchema,
});

export const createClientSchema = clientSchemaBase.superRefine((input, context) => {
  const digits = input.document.replace(/\D/g, "");

  if (input.personType === "PF" && input.documentType !== "CPF") {
    context.addIssue({ code: "custom", path: ["documentType"], message: "Pessoa fisica deve usar CPF." });
  }

  if (input.personType === "PJ" && input.documentType !== "CNPJ") {
    context.addIssue({ code: "custom", path: ["documentType"], message: "Pessoa juridica deve usar CNPJ." });
  }

  if (input.documentType === "CPF" && digits.length !== 11) {
    context.addIssue({ code: "custom", path: ["document"], message: "CPF deve ter 11 digitos." });
  }

  if (input.documentType === "CNPJ" && digits.length !== 14) {
    context.addIssue({ code: "custom", path: ["document"], message: "CNPJ deve ter 14 digitos." });
  }
});

export const updateClientSchema = clientSchemaBase
  .omit({ tenantId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

const nfeUnitSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => ["UN", "PC", "KG", "G", "CX", "PCT", "L", "ML", "M", "M2", "M3", "T"].includes(value), {
    message: "Unidade nao reconhecida para NF-e.",
  });

const fiscalRateSchema = z.string().trim().regex(/^\d+(\.\d+)?$/, "Aliquota deve ser numerica e usar ponto decimal.");
const optionalFiscalRateSchema = z.string().trim().regex(/^\d+(\.\d+)?$/, "Aliquota deve ser numerica e usar ponto decimal.").optional().or(z.literal(""));
const decimalStringSchema = z.string().trim().regex(/^\d+(\.\d{1,3})?$/, "Use ponto decimal, exemplo 0.500.").optional().or(z.literal(""));

const productFiscalSchema = z.object({
  ncm: z.string().trim().regex(/^\d{8}$/, "NCM deve conter exatamente 8 digitos."),
  cest: z.string().trim().max(12).optional().or(z.literal("")),
  origin: z.string().trim().regex(/^[0-8]$/, "Origem deve ser um codigo de 0 a 8."),
  cfop: z.string().trim().regex(/^[567]\d{3}$/, "CFOP deve ter 4 digitos e iniciar com 5, 6 ou 7."),
  icmsCstCsosn: z.string().trim().min(2).max(4),
  pisCst: z.string().trim().min(2).max(4),
  cofinsCst: z.string().trim().min(2).max(4),
  ipiCst: z.string().trim().max(4).optional().or(z.literal("")),
  icmsRate: fiscalRateSchema,
  pisRate: fiscalRateSchema,
  cofinsRate: fiscalRateSchema,
  ipiRate: optionalFiscalRateSchema,
  additionalInfo: z.string().trim().max(600).optional().or(z.literal("")),
});

const productAttributesSchema = z
  .object({
    leadTime: z.string().trim().max(80).optional(),
    availableColors: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
    subcategory: z.string().trim().max(120).optional().or(z.literal("")),
    commercialDescription: z.string().trim().min(1).max(120).optional(),
    complementaryDescription: z.string().trim().max(500).optional().or(z.literal("")),
    gtin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => value === "SEM GTIN" || /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value), {
        message: "GTIN deve ter 8, 12, 13 ou 14 digitos, ou SEM GTIN.",
      })
      .optional(),
    brand: z.string().trim().max(120).optional().or(z.literal("")),
    markupPercent: z.coerce.number().nonnegative().optional(),
    minSalePrice: moneySchema.optional(),
    priceTable: z.string().trim().max(120).optional().or(z.literal("")),
    stockUnit: nfeUnitSchema.optional(),
    commercialUnit: nfeUnitSchema.optional(),
    conversionFactor: z.string().trim().max(80).optional().or(z.literal("")),
    netWeightKg: decimalStringSchema,
    grossWeightKg: decimalStringSchema,
    packageDimensionsCm: z.string().trim().max(60).optional().or(z.literal("")),
    storageLocation: z.string().trim().max(120).optional().or(z.literal("")),
    tracksBatch: z.boolean().optional(),
    fiscal: productFiscalSchema.optional(),
    isResale: z.boolean().optional(),
    internalNotes: z.string().trim().max(800).optional().or(z.literal("")),
    saleBlocked: z.boolean().optional(),
  })
  .passthrough();

export const createProductSchema = z
  .object({
    tenantId: idSchema,
    sectorId: idSchema.optional(),
    sectorName: z.string().trim().min(2).max(120).optional(),
    sku: z.string().trim().min(1).max(60),
    name: z.string().trim().min(2).max(180),
    category: z.string().trim().min(2).max(120).default("Geral"),
    description: z.string().trim().max(4000).optional(),
    thumbnailUrl: z.string().trim().url().optional().or(z.literal("")),
    priceCost: moneySchema,
    priceSale: moneySchema,
    unitType: nfeUnitSchema.default("UN"),
    stockQty: z.coerce.number().nonnegative().default(0),
    stockMin: z.coerce.number().nonnegative().default(0),
    stockMax: z.coerce.number().nonnegative().optional(),
    trackStock: z.boolean().default(true),
    allowFractional: z.boolean().default(false),
    minOrderQty: z.coerce.number().positive().default(1),
    minFractionQty: z.coerce.number().positive().default(1),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    attributes: productAttributesSchema,
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
  })
  .superRefine((input, context) => {
    if (!input.attributes.fiscal) {
      context.addIssue({ code: "custom", path: ["attributes", "fiscal"], message: "Dados fiscais sao obrigatorios para NF-e." });
    }
    if (!input.attributes.commercialDescription) {
      context.addIssue({ code: "custom", path: ["attributes", "commercialDescription"], message: "Descricao comercial e obrigatoria." });
    }
    if (!input.attributes.gtin) {
      context.addIssue({ code: "custom", path: ["attributes", "gtin"], message: "GTIN/EAN e obrigatorio. Use SEM GTIN quando nao houver codigo." });
    }
  });

export const updateProductSchema = z
  .object({
    sectorId: idSchema.nullable().optional(),
    sectorName: z.string().trim().min(2).max(120).nullable().optional(),
    sku: z.string().trim().min(1).max(60).optional(),
    name: z.string().trim().min(2).max(180).optional(),
    category: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    thumbnailUrl: z.string().trim().url().nullable().optional(),
    priceCost: moneySchema.nullable().optional(),
    priceSale: moneySchema.optional(),
    unitType: z.string().trim().min(1).max(24).nullable().optional(),
    stockQty: z.coerce.number().nonnegative().optional(),
    stockMin: z.coerce.number().nonnegative().optional(),
    stockMax: z.coerce.number().nonnegative().optional(),
    trackStock: z.boolean().optional(),
    allowFractional: z.boolean().optional(),
    minOrderQty: z.coerce.number().positive().optional(),
    minFractionQty: z.coerce.number().positive().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    attributes: productAttributesSchema.optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const createInventoryMovementSchema = z.object({
  inventoryId: idSchema,
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "RESERVE", "RELEASE", "LOSS"]),
  quantity: quantitySchema,
  reason: z.string().trim().min(3).max(240),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: z.string().trim().max(120).optional(),
});

export const updateInventorySchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    category: z.string().trim().min(2).max(120).optional(),
    quantity: z.coerce.number().nonnegative().optional(),
    minQuantity: z.coerce.number().nonnegative().optional(),
    unit: z.string().trim().min(1).max(24).optional(),
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
    lastMove: z.string().trim().max(120).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const createFinanceEntrySchema = z.object({
  tenantId: idSchema,
  orderId: idSchema.optional(),
  quoteId: idSchema.optional(),
  label: z.string().trim().min(2).max(160),
  type: z.enum(["receivable", "payable", "profit", "margin", "cash"]),
  value: moneySchema,
  due: z.string().trim().max(80).optional(),
  status: z.enum(["Recebido", "Pendente", "Atrasado", "Projetado"]).default("Pendente"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const createFileSchema = z.object({
  tenantId: idSchema,
  name: z.string().trim().min(2).max(220),
  type: z.string().trim().min(2).max(40),
  size: z.string().trim().max(40).optional(),
  linkedTo: z.string().trim().max(160).optional(),
  url: z.string().trim().url().optional().or(z.literal("")),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const updateFileSchema = createFileSchema
  .omit({ tenantId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const updateNotificationSchema = z
  .object({
    read: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

const metadataSchema = z.record(z.string(), z.unknown()).default({});
const positiveMoneySchema = z.coerce.number().positive().multipleOf(0.01);
const optionalDateTimeSchema = z.string().datetime().optional();

const supplierBaseSchema = z.object({
  tenantId: idSchema,
  documentType: z.enum(["CPF", "CNPJ", "IE", "FOREIGN"]).default("CNPJ"),
  document: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(180),
  companyName: z.string().trim().max(180).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  contactName: z.string().trim().max(160).optional(),
  categories: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  addressZip: z.string().trim().max(12).optional(),
  addressStreet: z.string().trim().max(160).optional(),
  addressNumber: z.string().trim().max(30).optional(),
  addressComplement: z.string().trim().max(120).optional(),
  addressDistrict: z.string().trim().max(120).optional(),
  addressCity: z.string().trim().max(120).optional(),
  addressState: z.string().trim().length(2).optional().or(z.literal("")),
  addressCountry: z.string().trim().length(2).default("BR"),
  paymentTerms: z.string().trim().max(240).optional(),
  notes: optionalTextSchema,
  metadata: metadataSchema,
});

export const createSupplierSchema = supplierBaseSchema.superRefine((input, context) => {
  const digits = input.document.replace(/\D/g, "");
  if (input.documentType === "CPF" && digits.length !== 11) {
    context.addIssue({ code: "custom", path: ["document"], message: "CPF deve ter 11 digitos." });
  }
  if (input.documentType === "CNPJ" && digits.length !== 14) {
    context.addIssue({ code: "custom", path: ["document"], message: "CNPJ deve ter 14 digitos." });
  }
});

export const updateSupplierSchema = supplierBaseSchema
  .omit({ tenantId: true })
  .extend({
    status: z.enum(["ACTIVE", "BLOCKED", "INACTIVE"]).optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const createPurchaseOrderItemSchema = z.object({
  productId: idSchema.optional(),
  inventoryId: idSchema.optional(),
  description: z.string().trim().min(2).max(300),
  quantity: quantitySchema,
  unitCost: positiveMoneySchema,
  discount: moneySchema.default(0),
  metadata: metadataSchema,
});

export const createPurchaseOrderSchema = z.object({
  tenantId: idSchema,
  supplierId: idSchema,
  expectedDeliveryAt: optionalDateTimeSchema,
  status: z.enum(["DRAFT", "SENT", "APPROVED"]).default("DRAFT"),
  discountAmount: moneySchema.default(0),
  shippingAmount: moneySchema.default(0),
  taxAmount: moneySchema.default(0),
  notes: optionalTextSchema,
  metadata: metadataSchema,
  items: z.array(createPurchaseOrderItemSchema).min(1).max(100),
});

export const updatePurchaseOrderSchema = z
  .object({
    status: z.enum(["DRAFT", "SENT", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELED"]).optional(),
    paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELED"]).optional(),
    expectedDeliveryAt: z.string().datetime().nullable().optional(),
    receivedAt: z.string().datetime().nullable().optional(),
    paidAmount: moneySchema.optional(),
    notes: optionalTextSchema.nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const createPaymentTransactionSchema = z.object({
  tenantId: idSchema,
  orderId: idSchema.optional(),
  quoteId: idSchema.optional(),
  purchaseOrderId: idSchema.optional(),
  financeId: idSchema.optional(),
  direction: z.enum(["incoming", "outgoing"]),
  method: z.enum(["PIX", "BOLETO", "CARD", "CASH", "BANK_TRANSFER", "OTHER"]),
  provider: z.string().trim().max(120).optional(),
  providerReference: z.string().trim().max(180).optional(),
  amount: positiveMoneySchema,
  feeAmount: moneySchema.default(0),
  status: z.enum(["PENDING", "AUTHORIZED", "PAID", "FAILED", "CANCELED", "REFUNDED"]).default("PENDING"),
  dueAt: optionalDateTimeSchema,
  paidAt: optionalDateTimeSchema,
  metadata: metadataSchema,
});

export const updatePaymentTransactionSchema = z
  .object({
    status: z.enum(["PENDING", "AUTHORIZED", "PAID", "FAILED", "CANCELED", "REFUNDED"]).optional(),
    provider: z.string().trim().max(120).nullable().optional(),
    providerReference: z.string().trim().max(180).nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    paidAt: z.string().datetime().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const createFiscalDocumentSchema = z.object({
  tenantId: idSchema,
  orderId: idSchema.optional(),
  customerId: idSchema.optional(),
  type: z.enum(["NFE", "NFCE", "NFSE"]),
  operation: z.enum(["SALE", "SERVICE", "RETURN", "CANCEL"]).default("SALE"),
  environment: z.enum(["HOMOLOGATION", "PRODUCTION"]).default("HOMOLOGATION"),
  provider: z.string().trim().max(120).optional(),
  series: z.string().trim().max(20).optional(),
  number: z.string().trim().max(40).optional(),
  payload: metadataSchema,
  metadata: metadataSchema,
});

export const updateFiscalDocumentSchema = z
  .object({
    status: z.enum(["DRAFT", "QUEUED", "PROCESSING", "AUTHORIZED", "REJECTED", "CANCELED"]).optional(),
    provider: z.string().trim().max(120).nullable().optional(),
    series: z.string().trim().max(20).nullable().optional(),
    number: z.string().trim().max(40).nullable().optional(),
    accessKey: z.string().trim().max(80).nullable().optional(),
    protocol: z.string().trim().max(120).nullable().optional(),
    issuedAt: z.string().datetime().nullable().optional(),
    canceledAt: z.string().datetime().nullable().optional(),
    xmlUrl: z.string().trim().url().nullable().optional(),
    pdfUrl: z.string().trim().url().nullable().optional(),
    rejectionReason: z.string().trim().max(1000).nullable().optional(),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const createProductionWorkLogSchema = z.object({
  tenantId: idSchema,
  orderItemId: idSchema,
  machineId: idSchema.optional(),
  sectorId: idSchema.optional(),
  type: z.enum(["START", "PAUSE", "RESUME", "FINISH", "REWORK", "LOSS", "NOTE"]),
  quantityGood: z.coerce.number().nonnegative().default(0),
  quantityLoss: z.coerce.number().nonnegative().default(0),
  minutes: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().trim().max(1000).optional(),
  metadata: metadataSchema,
});

export const createQualityInspectionSchema = z
  .object({
    tenantId: idSchema,
    orderItemId: idSchema,
    status: z.enum(["APPROVED", "REJECTED", "REWORK"]),
    checkedQty: quantitySchema,
    rejectedQty: z.coerce.number().nonnegative().default(0),
    checklist: z.record(z.string(), z.union([z.boolean(), z.string(), z.number()])).default({}),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((input, context) => {
    if (input.rejectedQty > input.checkedQty) {
      context.addIssue({ code: "custom", path: ["rejectedQty"], message: "Rejeitado nao pode exceder conferido." });
    }
  });

export const reportQuerySchema = tenantQuerySchema
  .pick({ tenantId: true })
  .extend({
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
  });

export const permissionKeySchema = z.enum([
  "dashboard:read",
  "orders:read",
  "orders:write",
  "production:read",
  "production:write",
  "clients:read",
  "clients:write",
  "products:read",
  "products:write",
  "inventory:read",
  "inventory:write",
  "machines:read",
  "machines:write",
  "sectors:read",
  "sectors:write",
  "quotes:read",
  "quotes:write",
  "finance:read",
  "finance:write",
  "suppliers:read",
  "suppliers:write",
  "purchases:read",
  "purchases:write",
  "payments:read",
  "payments:write",
  "fiscal:read",
  "fiscal:write",
  "audit:read",
  "reports:read",
  "files:read",
  "files:write",
  "users:read",
  "users:write",
  "settings:read",
]);

export const createUserSchema = z.object({
  tenantId: idSchema,
  type: z.enum(["ADMIN", "OPERATOR", "CLIENT"]).default("OPERATOR"),
  name: z.string().trim().min(2).max(160),
  email: authEmailSchema,
  phone: z.string().trim().min(8).max(30).optional(),
  document: z.string().trim().max(18).optional(),
  avatarUrl: z.string().trim().url().optional().or(z.literal("")),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "FINANCE", "CLIENT", "VIEWER"]).default("OPERATOR"),
  permissions: z.array(permissionKeySchema).max(80).default([]),
  sectorIds: z.array(idSchema).max(80).default([]),
  password: strongPasswordSchema.optional(),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED", "INACTIVE"]).default("ACTIVE"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const updateUserSchema = createUserSchema
  .omit({ tenantId: true, password: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const updateUserPasswordSchema = z.object({
  password: strongPasswordSchema,
  temporary: z.boolean().default(true),
});

export const createSectorSchema = z.object({
  tenantId: idSchema,
  name: z.string().trim().min(2).max(120),
  description: optionalTextSchema,
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  icon: z.string().trim().max(80).optional(),
  kanbanOrder: z.coerce.number().int().min(0).default(0),
});

export const updateSectorSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: optionalTextSchema.nullable(),
    color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).nullable().optional(),
    icon: z.string().trim().max(80).nullable().optional(),
    status: z.string().trim().min(2).max(40).optional(),
    kanbanOrder: z.coerce.number().int().min(0).optional(),
    capacity: z.coerce.number().int().min(0).max(100).optional(),
    sla: z.string().trim().min(1).max(40).optional(),
    lead: z.string().trim().min(1).max(40).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const createMachineSchema = z.object({
  tenantId: idSchema,
  sectorId: idSchema,
  name: z.string().trim().min(2).max(140),
  model: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  capacityPerHour: z.coerce.number().nonnegative().default(0),
  costMonth: moneySchema.default(0),
  nextMaintenanceAt: z.string().datetime().optional(),
  description: optionalTextSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const updateMachineSchema = z
  .object({
    sectorId: idSchema.optional(),
    name: z.string().trim().min(2).max(140).optional(),
    model: z.string().trim().max(120).nullable().optional(),
    serialNumber: z.string().trim().max(120).nullable().optional(),
    status: z.enum(["OPERATIONAL", "DOWN", "MAINTENANCE"]).optional(),
    capacityPerHour: z.coerce.number().nonnegative().optional(),
    costMonth: moneySchema.optional(),
    nextMaintenanceAt: z.string().datetime().nullable().optional(),
    description: optionalTextSchema.nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const createMaintenanceTicketSchema = z.object({
  tenantId: idSchema,
  machineId: idSchema,
  assignedUserId: idSchema.nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(3).max(2000),
  observations: z.string().trim().max(2000).optional(),
});

export const updateMaintenanceTicketSchema = z
  .object({
    assignedUserId: idSchema.nullable().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_PARTS", "RESOLVED", "CANCELED"]).optional(),
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().min(3).max(2000).optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const createOrderItemSchema = z.object({
  productId: idSchema,
  variantId: idSchema.optional(),
  sectorId: idSchema.optional(),
  machineId: idSchema.optional(),
  assignedUserId: idSchema.optional(),
  description: z.string().trim().min(2).max(300),
  quantity: quantitySchema,
  unitPrice: moneySchema,
  discount: moneySchema.default(0),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  dueDate: z.string().datetime().optional(),
});

export const createOrderSchema = z.object({
  tenantId: idSchema,
  customerId: idSchema,
  quoteId: idSchema.optional(),
  expectedDeliveryAt: z.string().datetime().optional(),
  notes: optionalTextSchema,
  internalNotes: optionalTextSchema,
  items: z.array(createOrderItemSchema).min(1).max(100),
});

export const updateOrderSchema = z
  .object({
    status: z
      .enum(["DRAFT", "CONFIRMED", "IN_PRODUCTION", "READY", "SHIPPED", "DELIVERED", "CANCELED", "REFUNDED"])
      .optional(),
    paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE", "REFUNDED", "CANCELED"]).optional(),
    productionStatus: z
      .enum(["WAITING", "IN_QUEUE", "PICKING", "IN_PROGRESS", "PACKING", "PAUSED", "DONE", "REJECTED"])
      .optional(),
    expectedDeliveryAt: z.string().datetime().nullable().optional(),
    notes: optionalTextSchema.nullable(),
    internalNotes: optionalTextSchema.nullable(),
    carrier: z.string().trim().max(120).nullable().optional(),
    trackingCode: z.string().trim().max(120).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const moveOrderItemSchema = z.object({
  tenantId: idSchema,
  toStatus: z.enum([
    "PENDING",
    "QUEUED",
    "PICKING",
    "IN_PROGRESS",
    "PACKING",
    "PAUSED",
    "DONE",
    "CANCELED",
    "REJECTED",
    "SHIPPED",
  ]),
  toPosition: z.coerce.number().int().min(0).default(0),
  sectorId: idSchema.nullable().optional(),
  machineId: idSchema.nullable().optional(),
  assignedUserId: idSchema.nullable().optional(),
  note: z.string().trim().max(600).optional(),
});

export const createQuoteItemSchema = z.object({
  productId: idSchema,
  variantId: idSchema.optional(),
  description: z.string().trim().min(2).max(300),
  quantity: quantitySchema,
  unitPrice: moneySchema,
  discount: moneySchema.default(0),
  notes: optionalTextSchema,
});

export const createQuoteSchema = z.object({
  tenantId: idSchema,
  customerId: idSchema,
  validUntil: z.string().datetime(),
  notes: optionalTextSchema,
  internalNotes: optionalTextSchema,
  discountAmount: moneySchema.default(0),
  taxAmount: moneySchema.default(0),
  sendNow: z.boolean().default(true),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(15),
  metadata: metadataSchema,
  items: z.array(createQuoteItemSchema).min(1).max(100),
});

export const updateQuoteSchema = z
  .object({
    status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"]).optional(),
    validUntil: z.string().datetime().optional(),
    notes: optionalTextSchema.nullable(),
    internalNotes: optionalTextSchema.nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const acceptQuoteSchema = z.object({
  quoteId: idSchema,
  token: z.string().min(32).max(240),
  acceptedByName: z.string().trim().min(2).max(160),
  acceptedByEmail: z.string().trim().email(),
  acceptedIp: z
    .string()
    .regex(/^(([0-9]{1,3}\.){3}[0-9]{1,3}|[a-f0-9:]+)$/i)
    .optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateInventoryMovementInput = z.infer<typeof createInventoryMovementSchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type CreateFinanceEntryInput = z.infer<typeof createFinanceEntrySchema>;
export type CreateFileInput = z.infer<typeof createFileSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type CreatePaymentTransactionInput = z.infer<typeof createPaymentTransactionSchema>;
export type UpdatePaymentTransactionInput = z.infer<typeof updatePaymentTransactionSchema>;
export type CreateFiscalDocumentInput = z.infer<typeof createFiscalDocumentSchema>;
export type UpdateFiscalDocumentInput = z.infer<typeof updateFiscalDocumentSchema>;
export type CreateProductionWorkLogInput = z.infer<typeof createProductionWorkLogSchema>;
export type CreateQualityInspectionInput = z.infer<typeof createQualityInspectionSchema>;
export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserPasswordInput = z.infer<typeof updateUserPasswordSchema>;
export type CreateSectorInput = z.infer<typeof createSectorSchema>;
export type UpdateSectorInput = z.infer<typeof updateSectorSchema>;
export type CreateMachineInput = z.infer<typeof createMachineSchema>;
export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;
export type CreateMaintenanceTicketInput = z.infer<typeof createMaintenanceTicketSchema>;
export type UpdateMaintenanceTicketInput = z.infer<typeof updateMaintenanceTicketSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type MoveOrderItemInput = z.infer<typeof moveOrderItemSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RecoverPasswordInput = z.infer<typeof recoverPasswordSchema>;
