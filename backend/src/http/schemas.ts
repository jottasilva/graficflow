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

export const createProductSchema = z.object({
  tenantId: idSchema,
  sectorId: idSchema.optional(),
  sectorName: z.string().trim().min(2).max(120).optional(),
  sku: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(120).default("Geral"),
  description: z.string().trim().max(4000).optional(),
  thumbnailUrl: z.string().trim().url().optional().or(z.literal("")),
  priceCost: moneySchema.optional(),
  priceSale: moneySchema,
  unitType: z.string().trim().min(1).max(24).default("un"),
  stockQty: z.coerce.number().nonnegative().default(0),
  stockMin: z.coerce.number().nonnegative().default(0),
  stockMax: z.coerce.number().nonnegative().optional(),
  trackStock: z.boolean().default(true),
  allowFractional: z.boolean().default(false),
  minOrderQty: z.coerce.number().positive().default(1),
  minFractionQty: z.coerce.number().positive().default(1),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const updateProductSchema = z
  .object({
    sectorId: idSchema.nullable().optional(),
    sectorName: z.string().trim().min(2).max(120).nullable().optional(),
    sku: z.string().trim().min(2).max(80).optional(),
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
    attributes: z.record(z.string(), z.unknown()).optional(),
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
  sendNow: z.boolean().default(true),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(15),
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
