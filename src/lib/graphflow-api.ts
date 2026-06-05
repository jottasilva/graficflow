import { DEFAULT_PRODUCT_COLORS } from "./graphflow-data";
import type {
  Client,
  FileItem,
  FinanceEntry,
  InventoryItem,
  Machine,
  NotificationItem,
  Order,
  OrderStatus,
  Priority,
  Product,
  Quote,
  QuoteItem,
  QuoteStatus,
  Sector,
  UserAccount,
  UserAccountType,
} from "./graphflow-data";

export type ClientPayload = {
  tenantId: string;
  personType: "PF" | "PJ";
  documentType: "CPF" | "CNPJ";
  document: string;
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  avatarUrl?: string;
  addressZip?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressDistrict?: string;
  addressCity?: string;
  addressState?: string;
  addressCountry?: string;
  notes?: string;
};

export type DashboardOverview = {
  source: "supabase-pg_graphql";
  tenantId: string;
  queriedAt: string;
  totals: {
    customers: number;
    activeCustomers: number;
    orders: number;
    openOrders: number;
    productionOrders: number;
    revenue: number;
    quotes: number;
    acceptedQuotes: number;
    machines: number;
    machinesInMaintenance: number;
  };
};

export type WorkspaceData = {
  clients: Client[];
  products: Product[];
  inventory: InventoryItem[];
  machines: Machine[];
  sectors: Sector[];
  orders: Order[];
  quotes: Quote[];
  finance: FinanceEntry[];
  files: FileItem[];
  notifications: NotificationItem[];
  users: UserAccount[];
};

type AuthUser = {
  id: string;
  tenantId?: string;
  email?: string;
  role: string;
  permissions: string[];
  sectorIds?: string[];
  provider: string;
};

type AuthSession = {
  authenticated: boolean;
  user: AuthUser;
};

type CustomerDto = ClientPayload & {
  id: string;
  companyName: string | null;
  phone: string | null;
  whatsapp: string | null;
  avatarUrl: string | null;
  addressZip?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressDistrict?: string | null;
  addressCity: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  notes?: string | null;
  status: "ACTIVE" | "ATTENTION" | "INACTIVE";
};

type ProductDto = {
  id: string;
  name: string;
  category: string | null;
  thumbnailUrl?: string | null;
  sectorId?: string | null;
  sectorName?: string | null;
  priceSale: number | string | null;
  minOrderQty: number | string | null;
  minFractionQty: number | string | null;
  allowFractional: boolean | null;
  stockQty?: number | string | null;
  unitType?: string | null;
  attributes?: Record<string, unknown> | null;
  isActive: boolean | null;
};

type InventoryDto = {
  id: string;
  productId?: string | null;
  name: string;
  category: string | null;
  imageUrl?: string | null;
  quantity: number | string | null;
  minQuantity: number | string | null;
  unit: string | null;
  lastMove: string | null;
  metadata?: Record<string, unknown> | null;
};

type SectorDto = {
  id: string;
  name: string;
  capacity?: number | string | null;
  sla?: string | null;
  lead?: string | null;
};

type MachineDto = {
  id: string;
  sectorId?: string | null;
  name: string;
  status: "OPERATIONAL" | "DOWN" | "MAINTENANCE";
  nextMaintenanceAt?: string | null;
  costMonth?: number | string | null;
  monthlyUsageHours?: number | string | null;
};

type OrderItemDto = {
  id: string;
  productId?: string | null;
  description: string;
  quantity: number | string | null;
  unitPrice: number | string | null;
  total: number | string | null;
  status: string | null;
  priority: string | null;
  dueDate?: string | null;
  sectorId?: string | null;
  machineId?: string | null;
  assignedUserId?: string | null;
};

type OrderDto = {
  id: string;
  number: string | null;
  customerId: string;
  status: string | null;
  productionStatus: string | null;
  total: number | string | null;
  expectedDeliveryAt?: string | null;
  order_items?: OrderItemDto[];
};

type QuoteItemDto = {
  id: string;
  productId?: string | null;
  description: string;
  quantity: number | string | null;
  unitPrice: number | string | null;
  total: number | string | null;
};

type QuoteDto = {
  id: string;
  number: string | null;
  customerId: string;
  userId?: string | null;
  validUntil: string;
  notes?: string | null;
  status: string | null;
  createdAt?: string | null;
  publicLink?: string | null;
  quote_items?: QuoteItemDto[];
};

type FinanceDto = FinanceEntry & {
  metadata?: Record<string, unknown> | null;
  orderId?: string | null;
  quoteId?: string | null;
};
type FileDto = FileItem & {
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown> | null;
  url?: string | null;
};
type NotificationDto = {
  id: string;
  title: string;
  message: string;
  tone: NotificationItem["tone"];
  read: boolean;
  createdAt?: string | null;
};

type UserDto = {
  id: string;
  tenantId: string;
  type?: UserAccountType | null;
  name: string;
  email: string;
  phone?: string | null;
  document?: string | null;
  avatarUrl?: string | null;
  role: UserAccount["role"];
  permissions?: string[] | null;
  sectorIds?: string[] | null;
  status?: "ACTIVE" | "INVITED" | "SUSPENDED" | "INACTIVE" | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_GRAPHFLOW_API_URL?.replace(/\/$/, "") ?? "";
export const GRAPHFLOW_TENANT_ID = process.env.NEXT_PUBLIC_GRAPHFLOW_TENANT_ID ?? "graphflow-main";

function isEnabled(): boolean {
  return API_BASE_URL.length > 0;
}

function numeric(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function shortDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function dateOnly(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function statusFromApi(status: CustomerDto["status"]): Client["status"] {
  if (status === "ATTENTION") return "Atenção";
  if (status === "INACTIVE") return "Inativo";
  return "Ativo";
}

function mapOrderStatus(orderStatus?: string | null, productionStatus?: string | null, itemStatus?: string | null): OrderStatus {
  if (orderStatus === "DELIVERED") return "delivered";
  if (orderStatus === "SHIPPED") return "shipping";
  if (orderStatus === "CANCELED" || orderStatus === "REFUNDED") return "delivered";
  if (itemStatus === "DONE" || productionStatus === "DONE") return "shipping";
  if (itemStatus === "PACKING" || productionStatus === "PACKING") return "conference";
  if (itemStatus === "IN_PROGRESS" || productionStatus === "IN_PROGRESS") return "production";
  if (orderStatus === "CONFIRMED") return "payment";
  return "approval";
}

function mapPriority(priority?: string | null): Priority {
  if (priority === "LOW") return "Baixa";
  if (priority === "HIGH") return "Alta";
  if (priority === "URGENT" || priority === "CRITICAL") return "Crítica";
  return "Média";
}

function mapQuoteStatus(status?: string | null): QuoteStatus {
  if (status === "ACCEPTED" || status === "CONVERTED") return "Aceito";
  if (status === "EXPIRED" || status === "REJECTED") return "Expirado";
  if (status === "DRAFT") return "Rascunho";
  return "Enviado";
}

export function mapCustomerToClient(customer: CustomerDto): Client {
  return {
    id: customer.id,
    personType: customer.personType,
    documentType: customer.documentType,
    document: customer.document,
    name: customer.name,
    company: customer.companyName ?? customer.name,
    email: customer.email,
    phone: customer.phone ?? "",
    whatsapp: customer.whatsapp ?? "",
    city: customer.addressCity ?? "",
    address: {
      zip: customer.addressZip ?? "",
      street: customer.addressStreet ?? "",
      number: customer.addressNumber ?? "",
      complement: customer.addressComplement ?? "",
      district: customer.addressDistrict ?? "",
      city: customer.addressCity ?? "",
      state: customer.addressState ?? "",
      country: customer.addressCountry ?? "BR",
    },
    avatarUrl: customer.avatarUrl ?? "",
    notes: customer.notes ?? "",
    orders: 0,
    revenue: 0,
    status: statusFromApi(customer.status),
  };
}

function mapProduct(product: ProductDto): Product {
  const availableColors = Array.isArray(product.attributes?.availableColors)
    ? product.attributes.availableColors
        .filter((color): color is string => typeof color === "string" && color.trim().length > 0)
        .map((color) => color.trim())
    : DEFAULT_PRODUCT_COLORS;

  return {
    id: product.id,
    name: product.name,
    category: product.category ?? "Geral",
    sector: product.sectorName ?? "",
    thumbnailUrl: product.thumbnailUrl ?? "",
    availableColors: availableColors.length ? availableColors : DEFAULT_PRODUCT_COLORS,
    price: numeric(product.priceSale),
    minOrderQty: numeric(product.minOrderQty) || 1,
    minFractionQty: numeric(product.minFractionQty) || 1,
    allowsFractions: Boolean(product.allowFractional),
    stockItem: product.name,
    leadTime: String(product.attributes?.leadTime ?? ""),
    active: product.isActive !== false,
  };
}

function mapInventory(item: InventoryDto): InventoryItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category ?? "",
    imageUrl: item.imageUrl ?? stringMetadata(item.metadata, "imageUrl"),
    quantity: numeric(item.quantity),
    minQuantity: numeric(item.minQuantity),
    unit: item.unit ?? "un",
    lastMove: item.lastMove ?? "",
  };
}

function stringMetadata(metadata: Record<string, unknown> | null | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function mapSector(sector: SectorDto): Sector {
  return {
    id: sector.id,
    name: sector.name,
    orders: 0,
    capacity: numeric(sector.capacity),
    sla: sector.sla ?? "",
    lead: sector.lead ?? "",
  };
}

function mapMachine(machine: MachineDto, sectors: Sector[]): Machine {
  const sector = sectors.find((item) => item.id === machine.sectorId);
  const usageHours = numeric(machine.monthlyUsageHours);

  return {
    id: machine.id,
    name: machine.name,
    sector: sector?.name ?? "",
    status:
      machine.status === "MAINTENANCE"
        ? "Manutenção"
        : machine.status === "DOWN"
          ? "Ociosa"
          : "Operando",
    utilization: Math.min(100, Math.round((usageHours / 160) * 100)),
    nextMaintenance: shortDate(machine.nextMaintenanceAt),
    costMonth: numeric(machine.costMonth),
  };
}

function mapOrder(order: OrderDto, clients: Client[], products: Product[], sectors: Sector[]): Order {
  const firstItem = order.order_items?.[0];
  const product = products.find((item) => item.id === firstItem?.productId);
  const customer = clients.find((item) => item.id === order.customerId);
  const sector = sectors.find((item) => item.id === firstItem?.sectorId);
  const status = mapOrderStatus(order.status, order.productionStatus, firstItem?.status);

  return {
    id: order.id,
    number: order.number ?? order.id,
    itemId: firstItem?.id,
    customer: customer?.name ?? order.customerId,
    product: product?.name ?? firstItem?.description ?? "",
    productId: firstItem?.productId ?? product?.id ?? "",
    sector: sector?.name ?? product?.sector ?? "",
    machineId: firstItem?.machineId ?? undefined,
    responsible: firstItem?.assignedUserId ?? "",
    quantity: numeric(firstItem?.quantity),
    total: numeric(order.total ?? firstItem?.total),
    status,
    stageId: sector?.id,
    progress: status === "delivered" ? 100 : status === "shipping" ? 90 : status === "conference" ? 70 : status === "production" ? 45 : 10,
    delivery: shortDate(order.expectedDeliveryAt ?? firstItem?.dueDate),
    dueDate: dateOnly(order.expectedDeliveryAt ?? firstItem?.dueDate),
    priority: mapPriority(firstItem?.priority),
    fractions: [],
  };
}

function mapQuote(quote: QuoteDto, clients: Client[], products: Product[]): Quote {
  const client = clients.find((item) => item.id === quote.customerId);
  const items: QuoteItem[] = (quote.quote_items ?? []).map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return {
      id: item.id,
      productId: item.productId ?? "",
      productName: product?.name ?? item.description,
      quantity: numeric(item.quantity),
      unitPrice: numeric(item.unitPrice),
      total: numeric(item.total),
    };
  });

  return {
    id: quote.number ?? quote.id,
    customerId: quote.customerId,
    customerName: client?.name ?? quote.customerId,
    customerEmail: client?.email ?? "",
    responsible: quote.userId ?? "",
    validUntil: dateOnly(quote.validUntil),
    notes: quote.notes ?? "",
    status: mapQuoteStatus(quote.status),
    publicToken: quote.publicLink ?? "",
    createdAt: shortDate(quote.createdAt),
    items,
  };
}

function mapNotification(notification: NotificationDto): NotificationItem {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    time: shortDate(notification.createdAt) || "",
    tone: notification.tone,
    read: notification.read,
  };
}

function mapFinance(entry: FinanceDto): FinanceEntry {
  return {
    id: entry.id,
    label: entry.label,
    type: entry.type,
    value: numeric(entry.value),
    due: entry.due ?? "",
    status: entry.status,
    category: stringMetadata(entry.metadata, "category"),
    referenceType: stringMetadata(entry.metadata, "referenceType") as FinanceEntry["referenceType"],
    referenceId: entry.orderId ?? entry.quoteId ?? stringMetadata(entry.metadata, "referenceId"),
    paymentMethod: stringMetadata(entry.metadata, "paymentMethod"),
    notes: stringMetadata(entry.metadata, "notes"),
  };
}

function mapFile(file: FileDto): FileItem {
  return {
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    linkedTo: file.linkedTo,
    url: file.url ?? "",
    owner: stringMetadata(file.metadata, "owner"),
    notes: stringMetadata(file.metadata, "notes"),
    updatedAt: file.updatedAt ? shortDate(file.updatedAt) : file.updatedAt,
  };
}

function mapUser(user: UserDto): UserAccount {
  const statusMap: Record<NonNullable<UserDto["status"]>, UserAccount["status"]> = {
    ACTIVE: "Ativo",
    INVITED: "Convidado",
    SUSPENDED: "Suspenso",
    INACTIVE: "Inativo",
  };
  const metadata = user.metadata ?? {};

  return {
    id: user.id,
    tenantId: user.tenantId,
    type: user.type ?? (user.role === "CLIENT" ? "CLIENT" : user.role === "ADMIN" ? "ADMIN" : "OPERATOR"),
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    document: user.document ?? "",
    avatarUrl: user.avatarUrl ?? "",
    whatsapp: stringMetadata(metadata, "whatsapp"),
    personalEmail: stringMetadata(metadata, "personalEmail"),
    birthDate: stringMetadata(metadata, "birthDate"),
    address: {
      zip: stringMetadata(metadata, "addressZip"),
      street: stringMetadata(metadata, "addressStreet"),
      number: stringMetadata(metadata, "addressNumber"),
      complement: stringMetadata(metadata, "addressComplement"),
      district: stringMetadata(metadata, "addressDistrict"),
      city: stringMetadata(metadata, "addressCity"),
      state: stringMetadata(metadata, "addressState"),
      country: stringMetadata(metadata, "addressCountry") || "BR",
    },
    department: stringMetadata(metadata, "department"),
    jobTitle: stringMetadata(metadata, "jobTitle"),
    admissionDate: stringMetadata(metadata, "admissionDate"),
    supervisor: stringMetadata(metadata, "supervisor"),
    shift: stringMetadata(metadata, "shift"),
    costCenter: stringMetadata(metadata, "costCenter"),
    bank: stringMetadata(metadata, "bank"),
    bankAccount: stringMetadata(metadata, "bankAccount"),
    pixKey: stringMetadata(metadata, "pixKey"),
    notes: stringMetadata(metadata, "notes"),
    profileComplete: metadata.profileComplete === true,
    createdAt: user.createdAt ? shortDate(user.createdAt) : "",
    updatedAt: user.updatedAt ? shortDate(user.updatedAt) : "",
    role: user.role,
    permissions: user.permissions ?? [],
    sectorIds: user.sectorIds ?? [],
    status: statusMap[user.status ?? "ACTIVE"],
  };
}

function userMetadata(input: Partial<UserAccount>): Record<string, unknown> {
  return {
    whatsapp: input.whatsapp,
    personalEmail: input.personalEmail,
    birthDate: input.birthDate,
    addressZip: input.address?.zip,
    addressStreet: input.address?.street,
    addressNumber: input.address?.number,
    addressComplement: input.address?.complement,
    addressDistrict: input.address?.district,
    addressCity: input.address?.city,
    addressState: input.address?.state,
    addressCountry: input.address?.country,
    department: input.department,
    jobTitle: input.jobTitle,
    admissionDate: input.admissionDate,
    supervisor: input.supervisor,
    shift: input.shift,
    costCenter: input.costCenter,
    bank: input.bank,
    bankAccount: input.bankAccount,
    pixKey: input.pixKey,
    notes: input.notes,
    profileComplete: input.profileComplete,
  };
}

function orderStatusToApi(status: OrderStatus): string {
  if (status === "approval") return "CONFIRMED";
  if (status === "payment") return "CONFIRMED";
  if (status === "production") return "IN_PRODUCTION";
  if (status === "conference") return "READY";
  if (status === "shipping") return "SHIPPED";
  return "DELIVERED";
}

function orderItemStatusToApi(status: OrderStatus): string {
  if (status === "approval") return "PENDING";
  if (status === "payment") return "QUEUED";
  if (status === "production") return "IN_PROGRESS";
  if (status === "conference") return "PACKING";
  if (status === "shipping") return "SHIPPED";
  return "DONE";
}

function productionStatusToApi(status: OrderStatus): string {
  if (status === "approval") return "WAITING";
  if (status === "payment") return "IN_QUEUE";
  if (status === "production") return "IN_PROGRESS";
  if (status === "conference") return "PACKING";
  return "DONE";
}

function machineStatusToApi(status: Machine["status"]): MachineDto["status"] {
  if (status === "Ociosa") return "DOWN";
  if (status === "Operando") return "OPERATIONAL";
  return "MAINTENANCE";
}

function toDateTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.includes("/") ? value.split("/").reverse().join("-") : value;
  const date = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isEnabled()) {
    throw new Error("GraphFlow API URL nao configurada.");
  }

  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (init?.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Erro HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function tenantParams(extra?: Record<string, string>) {
  return new URLSearchParams({
    tenantId: GRAPHFLOW_TENANT_ID,
    page: "1",
    pageSize: "100",
    ...(extra ?? {}),
  });
}

async function listPaginated<T>(path: string, params: URLSearchParams): Promise<T[]> {
  const result = await request<Paginated<T>>(`${path}?${params.toString()}`);
  return result.data;
}

export const graphflowApi = {
  enabled: isEnabled,

  async uploadFile(file: File, scope: "clients" | "users" | "products" | "inventory" | "files" | "orders") {
    const formData = new FormData();
    formData.append("file", file);
    const params = new URLSearchParams({
      tenantId: GRAPHFLOW_TENANT_ID,
      scope,
    });

    return request<{ bucket: string; path: string; url: string; name: string; size: number; contentType: string }>(
      `/api/uploads?${params.toString()}`,
      {
        method: "POST",
        body: formData,
      },
    );
  },

  async login(input: { email: string; password: string; remember: boolean }) {
    return request<AuthSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async logout() {
    return request<{ authenticated: false }>("/api/auth/logout", { method: "POST" });
  },

  async session() {
    return request<AuthSession>("/api/auth/session");
  },

  async register(input: {
    name: string;
    companyName: string;
    email: string;
    password: string;
    passwordConfirmation: string;
  }) {
    return request<{ userId: string; tenantId: string; email: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async recoverPassword(email: string) {
    return request<{ delivered: true }>("/api/auth/recover", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async dashboardOverview(): Promise<DashboardOverview> {
    const params = tenantParams();
    return request<DashboardOverview>(`/api/graphql/dashboard-overview?${params.toString()}`);
  },

  async listClients(search = ""): Promise<Client[]> {
    const params = tenantParams(search.trim() ? { search: search.trim() } : undefined);
    const rows = await listPaginated<CustomerDto>("/api/clients", params);
    return rows.map(mapCustomerToClient);
  },

  async listUsers(search = ""): Promise<UserAccount[]> {
    const params = tenantParams(search.trim() ? { search: search.trim() } : undefined);
    const rows = await listPaginated<UserDto>("/api/users", params);
    return rows.map(mapUser);
  },

  async listProducts(search = ""): Promise<Product[]> {
    const params = tenantParams(search.trim() ? { search: search.trim() } : undefined);
    const rows = await listPaginated<ProductDto>("/api/products", params);
    return rows.map(mapProduct);
  },

  async listInventory(search = ""): Promise<InventoryItem[]> {
    const params = tenantParams(search.trim() ? { search: search.trim() } : undefined);
    const rows = await listPaginated<InventoryDto>("/api/inventory", params);
    return rows.map(mapInventory);
  },

  async listSectors(search = ""): Promise<Sector[]> {
    const params = tenantParams(search.trim() ? { search: search.trim() } : undefined);
    const rows = await listPaginated<SectorDto>("/api/sectors", params);
    return rows.map(mapSector);
  },

  async listMachines(sectors: Sector[], search = ""): Promise<Machine[]> {
    const params = tenantParams(search.trim() ? { search: search.trim() } : undefined);
    const rows = await listPaginated<MachineDto>("/api/machines", params);
    return rows.map((machine) => mapMachine(machine, sectors));
  },

  async listOrders(clients: Client[], products: Product[], sectors: Sector[], search = ""): Promise<Order[]> {
    const params = tenantParams(search.trim() ? { search: search.trim() } : undefined);
    const rows = await listPaginated<OrderDto>("/api/orders", params);
    return rows.map((order) => mapOrder(order, clients, products, sectors));
  },

  async listQuotes(clients: Client[], products: Product[], search = ""): Promise<Quote[]> {
    const params = tenantParams(search.trim() ? { search: search.trim() } : undefined);
    const rows = await listPaginated<QuoteDto>("/api/quotes", params);
    return rows.map((quote) => mapQuote(quote, clients, products));
  },

  async listFinance(): Promise<FinanceEntry[]> {
    const rows = await listPaginated<FinanceDto>("/api/finance", tenantParams());
    return rows.map(mapFinance);
  },

  async listFiles(): Promise<FileItem[]> {
    const rows = await listPaginated<FileDto>("/api/files", tenantParams());
    return rows.map(mapFile);
  },

  async listNotifications(): Promise<NotificationItem[]> {
    const rows = await listPaginated<NotificationDto>("/api/notifications", tenantParams());
    return rows.map(mapNotification);
  },

  async loadWorkspace(): Promise<WorkspaceData> {
    const [clients, users, sectors, products, inventory, finance, files, notifications] = await Promise.all([
      this.listClients(),
      this.listUsers(),
      this.listSectors(),
      this.listProducts(),
      this.listInventory(),
      this.listFinance(),
      this.listFiles(),
      this.listNotifications(),
    ]);

    const [machines, orders, quotes] = await Promise.all([
      this.listMachines(sectors),
      this.listOrders(clients, products, sectors),
      this.listQuotes(clients, products),
    ]);

    return { clients, users, products, inventory, machines, sectors, orders, quotes, finance, files, notifications };
  },

  async createClient(input: Omit<ClientPayload, "tenantId">): Promise<Client> {
    const customer = await request<CustomerDto>("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        tenantId: GRAPHFLOW_TENANT_ID,
      }),
    });

    return mapCustomerToClient(customer);
  },

  async createUser(input: Omit<UserAccount, "id" | "tenantId" | "status"> & { password?: string; status?: UserAccount["status"] }) {
    const statusMap: Record<UserAccount["status"], string> = {
      Ativo: "ACTIVE",
      Convidado: "INVITED",
      Suspenso: "SUSPENDED",
      Inativo: "INACTIVE",
    };

    const user = await request<UserDto>("/api/users", {
      method: "POST",
      body: JSON.stringify({
        tenantId: GRAPHFLOW_TENANT_ID,
        type: input.type,
        name: input.name,
        email: input.email,
        phone: input.phone,
        document: input.document,
        avatarUrl: input.avatarUrl,
        role: input.role,
        permissions: input.permissions,
        sectorIds: input.sectorIds,
        password: input.password,
        status: statusMap[input.status ?? "Ativo"],
        metadata: userMetadata(input),
      }),
    });

    return mapUser(user);
  },

  async updateUser(id: string, input: Partial<Omit<UserAccount, "id" | "tenantId">>) {
    const statusMap: Record<UserAccount["status"], string> = {
      Ativo: "ACTIVE",
      Convidado: "INVITED",
      Suspenso: "SUSPENDED",
      Inativo: "INACTIVE",
    };
    const user = await request<UserDto>(`/api/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...input,
        status: input.status ? statusMap[input.status] : undefined,
        metadata: userMetadata(input),
      }),
    });

    return mapUser(user);
  },

  async updateUserPassword(id: string, password: string, temporary = true) {
    return request<{ id: string; passwordUpdated: boolean; provider: string }>(
      `/api/users/${encodeURIComponent(id)}/password`,
      {
        method: "PATCH",
        body: JSON.stringify({ password, temporary }),
      },
    );
  },

  async deleteUser(id: string) {
    return request<{ id: string; deleted: boolean }>(`/api/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async createProduct(input: Product, sectorId?: string): Promise<Product> {
    const product = await request<ProductDto>("/api/products", {
      method: "POST",
      body: JSON.stringify({
        tenantId: GRAPHFLOW_TENANT_ID,
        sku: input.id || `SKU-${Date.now()}`,
        name: input.name,
        category: input.category,
        sectorId,
        sectorName: input.sector,
        thumbnailUrl: input.thumbnailUrl ?? "",
        priceSale: input.price,
        unitType: "un",
        stockQty: 0,
        stockMin: 0,
        allowFractional: input.allowsFractions,
        minOrderQty: input.minOrderQty,
        minFractionQty: input.minFractionQty,
        isActive: input.active,
        attributes: { leadTime: input.leadTime, availableColors: input.availableColors },
      }),
    });

    return mapProduct(product);
  },

  async updateProduct(id: string, input: Partial<Product>, sectorId?: string): Promise<Product> {
    const product = await request<ProductDto>(`/api/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: input.name,
        category: input.category,
        sectorId,
        sectorName: input.sector,
        thumbnailUrl: input.thumbnailUrl,
        priceSale: input.price,
        allowFractional: input.allowsFractions,
        minOrderQty: input.minOrderQty,
        minFractionQty: input.minFractionQty,
        isActive: input.active,
        attributes: {
          leadTime: input.leadTime ?? "",
          availableColors: input.availableColors ?? DEFAULT_PRODUCT_COLORS,
        },
      }),
    });

    return mapProduct(product);
  },

  async deleteProduct(id: string) {
    return request<{ id: string; deleted: boolean }>(`/api/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async updateInventoryItem(id: string, input: Partial<InventoryItem>): Promise<InventoryItem> {
    const item = await request<InventoryDto>(`/api/inventory/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return mapInventory(item);
  },

  async deleteInventoryItem(id: string) {
    return request<{ id: string; deleted: boolean }>(`/api/inventory/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async createOrder(input: {
    customerId: string;
    product: Product;
    quantity: number;
    deliveryDate: string;
    machineId?: string;
    sectorId?: string;
  }, clients: Client[], products: Product[], sectors: Sector[]): Promise<Order> {
    const dueDate = input.deliveryDate ? new Date(`${input.deliveryDate}T12:00:00`).toISOString() : undefined;
    const order = await request<OrderDto>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        tenantId: GRAPHFLOW_TENANT_ID,
        customerId: input.customerId,
        expectedDeliveryAt: dueDate,
        items: [
          {
            productId: input.product.id,
            sectorId: input.sectorId,
            machineId: input.machineId,
            description: input.product.name,
            quantity: input.quantity,
            unitPrice: input.product.price,
            discount: 0,
            priority: input.quantity * input.product.price > 3000 ? "HIGH" : "NORMAL",
            dueDate,
          },
        ],
      }),
    });

    return mapOrder(order, clients, products, sectors);
  },

  async createQuote(input: {
    customerId: string;
    validUntil: string;
    notes: string;
    internalNotes: string;
    items: QuoteItem[];
    sendNow: boolean;
  }, clients: Client[], products: Product[]): Promise<Quote> {
    const quote = await request<QuoteDto>("/api/quotes", {
      method: "POST",
      body: JSON.stringify({
        tenantId: GRAPHFLOW_TENANT_ID,
        customerId: input.customerId,
        validUntil: new Date(`${input.validUntil}T12:00:00`).toISOString(),
        notes: input.notes,
        internalNotes: input.internalNotes,
        sendNow: input.sendNow,
        items: input.items.map((item) => ({
          productId: item.productId,
          description: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: 0,
        })),
      }),
    });

    return mapQuote(quote, clients, products);
  },

  async createSector(name: string): Promise<Sector> {
    const sector = await request<SectorDto>("/api/sectors", {
      method: "POST",
      body: JSON.stringify({
        tenantId: GRAPHFLOW_TENANT_ID,
        name,
      }),
    });

    return mapSector(sector);
  },

  async updateSector(id: string, input: Partial<Pick<Sector, "name" | "capacity" | "sla" | "lead">>): Promise<Sector> {
    const sector = await request<SectorDto>(`/api/sectors/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });

    return mapSector(sector);
  },

  async deleteSector(id: string) {
    return request<{ id: string; deleted: boolean }>(`/api/sectors/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async createMachine(input: {
    name: string;
    sectorId: string;
    model?: string;
    serialNumber?: string;
    capacityPerHour: number;
    costMonth: number;
    nextMaintenanceAt?: string;
    description?: string;
  }, sectors: Sector[]): Promise<Machine> {
    const machine = await request<MachineDto>("/api/machines", {
      method: "POST",
      body: JSON.stringify({
        tenantId: GRAPHFLOW_TENANT_ID,
        ...input,
        nextMaintenanceAt: toDateTime(input.nextMaintenanceAt),
      }),
    });

    return mapMachine(machine, sectors);
  },

  async updateMachine(
    id: string,
    input: Partial<Pick<Machine, "name" | "status" | "nextMaintenance" | "costMonth">> & { sectorId?: string },
    sectors: Sector[],
  ): Promise<Machine> {
    const machine = await request<MachineDto>(`/api/machines/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        sectorId: input.sectorId,
        name: input.name,
        status: input.status ? machineStatusToApi(input.status) : undefined,
        costMonth: input.costMonth,
        nextMaintenanceAt: toDateTime(input.nextMaintenance),
      }),
    });

    return mapMachine(machine, sectors);
  },

  async deleteMachine(id: string) {
    return request<{ id: string; deleted: boolean }>(`/api/machines/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async createMaintenanceTicket(input: {
    machineId: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    title: string;
    description: string;
    assignedUserId?: string;
    observations?: string;
  }) {
    return request<unknown>("/api/maintenance-tickets", {
      method: "POST",
      body: JSON.stringify({
        tenantId: GRAPHFLOW_TENANT_ID,
        ...input,
      }),
    });
  },

  async createInventoryMovement(input: {
    inventoryId: string;
    type: "IN" | "OUT" | "ADJUSTMENT" | "RESERVE" | "RELEASE" | "LOSS";
    quantity: number;
    reason: string;
  }) {
    return request<{ inventory: InventoryDto; movement: unknown }>("/api/inventory/movements", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateOrderStatus(id: string, status: OrderStatus) {
    return request<Partial<OrderDto>>(`/api/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: orderStatusToApi(status),
        productionStatus: productionStatusToApi(status),
      }),
    });
  },

  async updateOrder(id: string, input: {
    status?: OrderStatus;
    deliveryDate?: string;
    notes?: string;
    internalNotes?: string;
    clientSnapshot?: Record<string, string>;
  }) {
    return request<Partial<OrderDto>>(`/api/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: input.status ? orderStatusToApi(input.status) : undefined,
        productionStatus: input.status ? productionStatusToApi(input.status) : undefined,
        expectedDeliveryAt: toDateTime(input.deliveryDate),
        notes: input.notes,
        internalNotes: input.internalNotes,
        metadata: input.clientSnapshot ? { clientSnapshot: input.clientSnapshot } : undefined,
      }),
    });
  },

  async moveOrderItem(itemId: string, input: { status: OrderStatus; stageId: string; position?: number; machineId?: string }) {
    return request<OrderItemDto>(`/api/order-items/${encodeURIComponent(itemId)}/move`, {
      method: "PATCH",
      body: JSON.stringify({
        tenantId: GRAPHFLOW_TENANT_ID,
        toStatus: orderItemStatusToApi(input.status),
        toPosition: input.position ?? 0,
        sectorId: input.stageId,
        machineId: input.machineId,
      }),
    });
  },

  async createFinanceEntry(input: Omit<FinanceEntry, "id">): Promise<FinanceEntry> {
    const entry = await request<FinanceDto>("/api/finance", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        tenantId: GRAPHFLOW_TENANT_ID,
        metadata: {
          category: input.category,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          paymentMethod: input.paymentMethod,
          notes: input.notes,
        },
      }),
    });
    return mapFinance(entry);
  },

  async createFile(input: Omit<FileItem, "id" | "updatedAt" | "size"> & { size?: string }): Promise<FileItem> {
    const file = await request<FileDto>("/api/files", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        tenantId: GRAPHFLOW_TENANT_ID,
        metadata: {
          owner: input.owner,
          notes: input.notes,
        },
      }),
    });
    return mapFile(file);
  },

  async updateFile(id: string, input: Partial<Omit<FileItem, "id" | "updatedAt">>): Promise<FileItem> {
    const file = await request<FileDto>(`/api/files/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...input,
        metadata: {
          owner: input.owner,
          notes: input.notes,
        },
      }),
    });
    return mapFile(file);
  },

  async deleteFile(id: string) {
    return request<{ id: string; deleted: boolean }>(`/api/files/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async updateNotification(id: string, input: { read: boolean }) {
    const params = tenantParams();
    return request<NotificationDto>(`/api/notifications/${encodeURIComponent(id)}?${params.toString()}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async deleteNotification(id: string) {
    const params = tenantParams();
    return request<{ id: string; deleted: boolean }>(`/api/notifications/${encodeURIComponent(id)}?${params.toString()}`, {
      method: "DELETE",
    });
  },
};
