"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellRing,
  BookOpen,
  Boxes,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Cpu,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  Factory,
  FileText,
  Folder,
  Globe,
  Funnel,
  GripVertical,
  Home,
  Info,
  Layers3,
  LayoutGrid,
  Lightbulb,
  Link2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  MoreVertical,
  Moon,
  Paperclip,
  Package,
  Percent,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Tag,
  Trash2,
  Truck,
  Upload,
  User,
  UserPlus,
  UserCog,
  Users,
  WalletCards,
  Warehouse,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { AuthPage } from "@/components/auth-page";
import { LandingView } from "@/components/landing-view";
import { ToastProvider, useToast } from "@/components/toast-provider";
import {
  calculateOrderTotal,
  DEFAULT_PRODUCT_COLORS,
  formatCurrency,
  formatNumber,
  navItems,
  normalizeText,
  orderMatchesQuery,
  productMatchesQuery,
  QUOTE_ACCEPTANCE_KEY,
  statusMeta,
  sumFractions,
  type Client,
  type FileItem,
  type FinanceEntry,
  type Fraction,
  type InventoryItem,
  type Machine,
  type NotificationItem,
  type Order,
  type OrderArtFile,
  type OrderStatus,
  type Product,
  type ProductFiscalData,
  type Quote,
  type QuoteItem,
  type QuoteStatus,
  type Sector,
  type UserAccount,
  type ViewKey,
} from "@/lib/graphflow-data";
import {
  graphflowApi,
  GraphflowApiError,
  type DashboardOverview,
  type ManagementReport,
  type PaymentTransactionRecord,
} from "@/lib/graphflow-api";
import { PERMISSION_LABELS } from "@/shared/permissions";
import type { PermissionKey } from "@/shared/permissions";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";

const GRAPHFLOW_LOGO_SRC = "/assets/d2513524-f181-4a63-9fff-94a95de5aacf.png";

type ModalMode =
  | "order"
  | "order-detail"
  | "quote-detail"
  | "client"
  | "user"
  | "product"
  | "product-edit"
  | "machine"
  | "maintenance"
  | "expense"
  | "quote"
  | "file"
  | null;

type ToastItem = {
  id: string;
  tone: NotificationItem["tone"];
  title: string;
  message: string;
  fields?: string[];
};

type DateFilter = "all" | "today" | "next7" | "next30" | "overdue";

const dateAwareViews = new Set<ViewKey>(["dashboard", "orders", "production", "reports"]);

function todayLongLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function formatNotificationField(field: string) {
  const normalized = field.trim();
  const knownLabels: Record<string, string> = {
    sku: "SKU",
    name: "Nome",
    category: "Categoria",
    subcategory: "Subcategoria",
    sector: "Setor",
    priceCost: "Preço de custo",
    priceSale: "Preço de venda",
    costPrice: "Preço de custo",
    commercialDescription: "Descrição comercial",
    complementaryDescription: "Descrição complementar",
    gtin: "GTIN",
    minOrderQty: "Pedido mínimo",
    minFractionQty: "Mínimo fracionado",
    stockQty: "Estoque atual",
    stockMin: "Estoque mínimo",
    stockUnit: "Unidade de estoque",
    commercialUnit: "Unidade comercial",
    conversionFactor: "Fator de conversão",
    netWeightKg: "Peso líquido",
    grossWeightKg: "Peso bruto",
    packageDimensionsCm: "Dimensões",
    storageLocation: "Local de armazenamento",
    document: "Documento",
    email: "E-mail",
    phone: "Telefone",
    whatsapp: "WhatsApp",
    addressZip: "CEP",
    addressStreet: "Endereço",
    addressNumber: "Número",
    addressComplement: "Complemento",
    addressDistrict: "Bairro",
    addressCity: "Cidade",
    addressState: "UF",
  };

  if (knownLabels[normalized]) {
    return knownLabels[normalized];
  }

  return normalized
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNotificationFields(message: string) {
  return (
    message
      .split(";")
      .map((part) => part.trim())
      .flatMap((part) => {
        if (!part.includes(": ")) {
          return [];
        }

        const pieces = part.split(": ").map((piece) => piece.trim()).filter(Boolean);
        if (pieces.length >= 3 && /entrada invalida|revise os campos|falha|erro/i.test(pieces[0] ?? "")) {
          return [pieces[1]];
        }

        if (pieces.length === 2 && /entrada invalida|revise os campos|falha|erro/i.test(pieces[0] ?? "")) {
          return [pieces[1]];
        }

        if (pieces.length >= 2) {
          return [pieces[0]];
        }

        return [];
      })
  );
}

function dateFilterOptions() {
  return [
    { value: "all", label: "Todos os períodos" },
    { value: "today", label: `Hoje, ${todayLongLabel()}` },
    { value: "next7", label: "Próximos 7 dias" },
    { value: "next30", label: "Próximos 30 dias" },
    { value: "overdue", label: "Atrasados" },
  ] satisfies Array<{ value: DateFilter; label: string }>;
}

type NewOrderDraft = {
  orderNumber: string;
  orderDate: string;
  customerId: string;
  productId: string;
  quantity: number;
  deliveryDate: string;
  notes: string;
  items: NewOrderItem[];
  fractions: Fraction[];
  artFileName: string;
  artFileUrl: string;
};

type NewOrderItem = {
  id: string;
  productId: string;
  quantity: number;
  note: string;
  artFileName: string;
  artFileUrl: string;
};

type ClientDraft = {
  personType: "PF" | "PJ";
  documentType: "CPF" | "CNPJ";
  document: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  avatarUrl: string;
  addressZip: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressDistrict: string;
  addressCity: string;
  addressState: string;
  notes: string;
};

type UserDraft = {
  type: UserAccount["type"];
  name: string;
  email: string;
  phone: string;
  document: string;
  avatarUrl: string;
  role: UserAccount["role"];
  permissions: PermissionKey[];
  sectorIds: string[];
  password: string;
};

type AuthSessionUser = {
  id: string;
  tenantId?: string;
  email?: string;
  role?: string;
};

type SidebarUserProfile = {
  name: string;
  subtitle: string;
  initials: string;
  avatarUrl?: string;
  email?: string;
};

type ProductDraft = {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  sector: string;
  machineId: string;
  description: string;
  commercialDescription: string;
  complementaryDescription: string;
  gtin: string;
  brand: string;
  thumbnailUrl: string;
  price: number;
  costPrice: number;
  markupPercent: number;
  minSalePrice: number;
  priceTable: string;
  minOrderQty: number;
  minFractionQty: number;
  allowsFractions: boolean;
  stockItem: string;
  stockQty: number;
  stockMin: number;
  stockUnit: string;
  commercialUnit: string;
  conversionFactor: string;
  netWeightKg: string;
  grossWeightKg: string;
  packageDimensionsCm: string;
  storageLocation: string;
  tracksBatch: boolean;
  fiscal: ProductFiscalData;
  skipFiscalData: boolean;
  isResale: boolean;
  internalNotes: string;
  saleBlocked: boolean;
  availableColorsText: string;
};

type MachineDraft = {
  name: string;
  sectorId: string;
  model: string;
  serialNumber: string;
  capacityPerHour: number;
  costMonth: number;
  nextMaintenanceAt: string;
  description: string;
};

type MaintenanceDraft = {
  machineId: string;
  assignedUserId: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  observations: string;
};

type ExpenseDraft = {
  label: string;
  type: FinanceEntry["type"];
  value: number;
  due: string;
  status: FinanceEntry["status"];
  category: string;
  referenceType: FinanceEntry["referenceType"];
  referenceId: string;
  paymentMethod: string;
  notes: string;
};

type InventoryDraft = Pick<InventoryItem, "name" | "category" | "imageUrl" | "quantity" | "minQuantity" | "unit" | "lastMove">;

type OrderEditDraft = Pick<
  Order,
  "id" | "customer" | "productId" | "sector" | "quantity" | "status" | "progress" | "delivery" | "priority"
> & {
  machineId: string;
  responsible: string;
};

type QuoteDraft = {
  customerId: string;
  contactName: string;
  customerEmail: string;
  customerPhone: string;
  responsible: string;
  validUntil: string;
  issueDate: string;
  paymentCondition: string;
  productionDeadline: string;
  discount: number;
  discountType: "percent" | "currency";
  notes: string;
  internalNotes: string;
  items: QuoteItem[];
};

type HeaderAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void | Promise<void>;
};

type UploadScope = "clients" | "users" | "products" | "inventory" | "files" | "orders";

type UploadedFile = {
  url: string;
  name: string;
  size: number;
  contentType: string;
  path?: string;
};

const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const UPLOAD_MAX_LABEL = "25 MB";

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

async function safeUploadFile(
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>,
  file: File,
  scope: UploadScope,
) {
  try {
    return await onUploadFile(file, scope);
  } catch {
    return null;
  }
}

type ProductionStage = {
  id: string;
  name: string;
  color: string;
  status?: OrderStatus;
};

type FileDraft = {
  name: string;
  type: FileItem["type"];
  linkedTo: string;
  url: string;
  owner: string;
  notes: string;
};

function dateInputAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function todayAtNoon() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date;
}

type PaymentMethod = PaymentTransactionRecord["method"];
type PaymentStatus = PaymentTransactionRecord["status"];

type OrderPaymentInput = {
  amount: number;
  method: PaymentMethod;
  status: Extract<PaymentStatus, "PENDING" | "PAID">;
  date: string;
  providerReference: string;
  notes: string;
};

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "PIX", label: "Pix" },
  { value: "CARD", label: "Cartao" },
  { value: "CASH", label: "Dinheiro" },
  { value: "BOLETO", label: "Boleto" },
  { value: "BANK_TRANSFER", label: "Transferencia" },
  { value: "OTHER", label: "Outro" },
];

const paymentMethodLabels = Object.fromEntries(
  paymentMethodOptions.map((option) => [option.value, option.label]),
) as Record<PaymentMethod, string>;

const paymentStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  AUTHORIZED: "Autorizado",
  PAID: "Recebido",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
  REFUNDED: "Estornado",
};

function dateInputToIso(value: string) {
  return new Date(`${value || todayInputDate()}T12:00:00`).toISOString();
}

function firstProductColor(product?: Product) {
  return product?.availableColors?.[0] ?? DEFAULT_PRODUCT_COLORS[0];
}

function parseAvailableColors(value: string) {
  const colors = value
    .split(/[,;\n]/)
    .map((color) => color.trim())
    .filter(Boolean);

  return colors.length ? Array.from(new Set(colors)) : DEFAULT_PRODUCT_COLORS;
}

function roleLabel(role?: string) {
  if (role === "ADMIN") return "Administrador";
  if (role === "MANAGER") return "Gerente";
  if (role === "FINANCE") return "Financeiro";
  if (role === "CLIENT") return "Cliente";
  if (role === "VIEWER") return "Leitura";
  return "Operador";
}

function accountInitials(nameOrEmail: string) {
  const clean = nameOrEmail.trim();
  if (!clean) return "GF";
  const namePart = clean.includes("@") ? clean.split("@")[0] : clean;
  const words = namePart
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "GF";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function sidebarUserProfile(user: UserAccount | null | undefined, sessionUser: AuthSessionUser | null): SidebarUserProfile {
  const email = user?.email || sessionUser?.email || "";
  const name = user?.name || email || "Usuário";
  const subtitle = user?.jobTitle || roleLabel(user?.role ?? sessionUser?.role);

  return {
    name,
    subtitle,
    initials: accountInitials(name || email),
    avatarUrl: user?.avatarUrl || undefined,
    email: email || undefined,
  };
}

const nfeUnits = new Set(["UN", "PC", "KG", "G", "CX", "PCT", "L", "ML", "M", "M2", "M3", "T"]);

function normalizeSku(value: string) {
  return value.trim().slice(0, 60);
}

function normalizeGtin(value: string) {
  const trimmed = value.trim().toUpperCase();
  return trimmed || "SEM GTIN";
}

function parseLocaleNumber(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validateProductFiscalDraft(draft: ProductDraft) {
  const missing: string[] = [];
  const invalid: string[] = [];
  const alerts: string[] = [];
  const fiscal = draft.fiscal;
  const requiredFields: Array<[string, string | number]> = [
    ["GTIN/EAN", draft.gtin],
    ...(draft.skipFiscalData
      ? []
      : [
          ["NCM", fiscal.ncm],
          ["Origem da mercadoria", fiscal.origin],
          ["CFOP padrao saida", fiscal.cfop],
          ["CST / CSOSN ICMS", fiscal.icmsCstCsosn],
          ["CST PIS", fiscal.pisCst],
          ["CST COFINS", fiscal.cofinsCst],
          ["Aliquota ICMS", fiscal.icmsRate],
          ["Aliquota PIS", fiscal.pisRate],
          ["Aliquota COFINS", fiscal.cofinsRate],
        ] as Array<[string, string | number]>),
    ["Unidade comercial", draft.commercialUnit],
    ["Unidade de estoque", draft.stockUnit],
    ["Preco de venda", draft.price],
    ["Preco de custo", draft.costPrice],
    ["Estoque atual", draft.stockQty],
    ["Estoque minimo", draft.stockMin],
  ];

  requiredFields.forEach(([label, value]) => {
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value <= 0) missing.push(label);
      return;
    }
    if (!String(value ?? "").trim()) missing.push(label);
  });

  if (draft.name.trim().length < 2) {
    missing.push("Nome do produto");
    if (draft.name.trim().length > 0) invalid.push("Nome do produto deve ter pelo menos 2 caracteres.");
  }
  if (draft.category.trim().length < 2) invalid.push("Categoria deve ter pelo menos 2 caracteres.");
  if (draft.sku.trim().length > 60) invalid.push("SKU deve ter no maximo 60 caracteres.");
  if (draft.commercialDescription.trim().length > 120) invalid.push("Descricao comercial deve ter no maximo 120 caracteres.");
  if (!/^(SEM GTIN|\d{8}|\d{12}|\d{13}|\d{14})$/.test(normalizeGtin(draft.gtin))) {
    invalid.push("GTIN/EAN deve ter 8, 12, 13 ou 14 digitos, ou SEM GTIN.");
  }

  if (!draft.skipFiscalData) {
    if (!/^\d{8}$/.test(fiscal.ncm.trim())) invalid.push("NCM deve conter exatamente 8 digitos numericos.");
    if (!/^[567]\d{3}$/.test(fiscal.cfop.trim())) invalid.push("CFOP deve ter 4 digitos e iniciar com 5, 6 ou 7.");
    if (!/^[0-8]$/.test(fiscal.origin.trim())) invalid.push("Origem da mercadoria deve ser um codigo de 0 a 8.");

    [
      ["Aliquota ICMS", fiscal.icmsRate],
      ["Aliquota PIS", fiscal.pisRate],
      ["Aliquota COFINS", fiscal.cofinsRate],
      ["Aliquota IPI", fiscal.ipiRate],
    ].forEach(([label, value]) => {
      const raw = String(value).trim();
      if (raw && !/^\d+(\.\d+)?$/.test(raw)) invalid.push(`${label} deve ser numerica e usar ponto decimal.`);
    });
  }

  [draft.commercialUnit, draft.stockUnit].forEach((unit) => {
    if (unit && !nfeUnits.has(unit.trim().toUpperCase())) {
      invalid.push(`Unidade ${unit} nao esta na lista reconhecida para NF-e.`);
    }
  });

  [
    ["Peso liquido", draft.netWeightKg],
    ["Peso bruto", draft.grossWeightKg],
  ].forEach(([label, value]) => {
    const raw = String(value).trim();
    if (raw.includes(",")) invalid.push(`${label} deve usar ponto como separador decimal.`);
    if (raw && !/^\d+(\.\d{1,3})?$/.test(raw)) invalid.push(`${label} deve ser numerico, exemplo 0.500.`);
  });

  if (draft.skipFiscalData) alerts.push("Dados fiscais desativados para este cadastro.");
  if (!draft.skipFiscalData && !fiscal.cest.trim()) alerts.push("CEST vazio: preencha se houver ICMS-ST.");
  if (!draft.netWeightKg.trim()) alerts.push("Peso liquido vazio: recomendado para NF-e com frete.");
  if (!draft.grossWeightKg.trim()) alerts.push("Peso bruto vazio: recomendado para cotacao e frete.");
  if (!draft.storageLocation.trim()) alerts.push("Local de armazenagem vazio.");

  return { missing, invalid, alerts, ready: missing.length === 0 && invalid.length === 0 };
}

function productFromDraft(draft: ProductDraft, id: string): Product {
  return {
    id,
    sku: normalizeSku(draft.sku) || id.toUpperCase(),
    name: draft.name.trim(),
    category: draft.category.trim() || "Geral",
    subcategory: draft.subcategory.trim(),
    sector: draft.sector,
    machineId: draft.machineId || undefined,
    description: draft.description.trim(),
    commercialDescription: draft.commercialDescription.trim() || draft.name.trim(),
    complementaryDescription: draft.complementaryDescription.trim(),
    gtin: normalizeGtin(draft.gtin),
    brand: draft.brand.trim(),
    thumbnailUrl: draft.thumbnailUrl,
    availableColors: parseAvailableColors(draft.availableColorsText),
    price: draft.price,
    costPrice: draft.costPrice,
    markupPercent: draft.markupPercent,
    minSalePrice: draft.minSalePrice,
    priceTable: draft.priceTable.trim(),
    minOrderQty: draft.minOrderQty,
    minFractionQty: draft.minFractionQty,
    allowsFractions: draft.allowsFractions,
    stockItem: draft.stockItem,
    stockQty: draft.stockQty,
    stockMin: draft.stockMin,
    stockUnit: draft.stockUnit.trim().toUpperCase(),
    commercialUnit: draft.commercialUnit.trim().toUpperCase(),
    conversionFactor: draft.conversionFactor.trim(),
    netWeightKg: draft.netWeightKg.trim(),
    grossWeightKg: draft.grossWeightKg.trim(),
    packageDimensionsCm: draft.packageDimensionsCm.trim(),
    storageLocation: draft.storageLocation.trim(),
    tracksBatch: draft.tracksBatch,
    fiscal: draft.skipFiscalData ? undefined : { ...draft.fiscal },
    skipFiscalData: draft.skipFiscalData,
    isResale: draft.isResale,
    internalNotes: draft.internalNotes.trim(),
    leadTime: "2 dias",
    active: !draft.saleBlocked,
    saleBlocked: draft.saleBlocked,
  };
}

function productHasFiscalData(product: Product) {
  const fiscal = product.fiscal;
  return Boolean(
    fiscal &&
      [fiscal.ncm, fiscal.icmsCstCsosn, fiscal.pisCst, fiscal.cofinsCst, fiscal.icmsRate, fiscal.pisRate, fiscal.cofinsRate].some(
        (value) => String(value ?? "").trim().length > 0,
      ),
  );
}

const defaultOrderDraft = (products: Product[], clients: Client[]): NewOrderDraft => ({
  orderNumber: "",
  orderDate: todayInputDate(),
  customerId: clients[0]?.id ?? "",
  productId: "",
  quantity: 0,
  deliveryDate: dateInputAfterDays(7),
  notes: "",
  items: [],
  artFileName: "",
  artFileUrl: "",
  fractions: [],
});

const defaultClientDraft: ClientDraft = {
  personType: "PJ",
  documentType: "CNPJ",
  document: "",
  name: "",
  company: "",
  email: "",
  phone: "",
  whatsapp: "",
  avatarUrl: "",
  addressZip: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressDistrict: "",
  addressCity: "",
  addressState: "",
  notes: "",
};

const defaultUserDraft: UserDraft = {
  type: "OPERATOR",
  name: "",
  email: "",
  phone: "",
  document: "",
  avatarUrl: "",
  role: "OPERATOR",
  permissions: ["dashboard:read" as PermissionKey, "orders:read" as PermissionKey, "production:read" as PermissionKey],
  sectorIds: [],
  password: "",
};

const defaultProductFiscal: ProductFiscalData = {
  ncm: "",
  cest: "",
  origin: "0",
  cfop: "5102",
  icmsCstCsosn: "",
  pisCst: "",
  cofinsCst: "",
  ipiCst: "",
  icmsRate: "",
  pisRate: "",
  cofinsRate: "",
  ipiRate: "",
  additionalInfo: "",
};

const defaultProductDraft: ProductDraft = {
  sku: "",
  name: "",
  category: "Papelaria",
  subcategory: "",
  sector: "Impressão",
  machineId: "",
  description: "",
  commercialDescription: "",
  complementaryDescription: "",
  gtin: "SEM GTIN",
  brand: "",
  thumbnailUrl: "",
  availableColorsText: DEFAULT_PRODUCT_COLORS.join(", "),
  price: 0,
  costPrice: 0,
  markupPercent: 0,
  minSalePrice: 0,
  priceTable: "",
  minOrderQty: 50,
  minFractionQty: 50,
  allowsFractions: true,
  stockItem: "Vinil Branco",
  stockQty: 0,
  stockMin: 0,
  stockUnit: "UN",
  commercialUnit: "UN",
  conversionFactor: "",
  netWeightKg: "",
  grossWeightKg: "",
  packageDimensionsCm: "",
  storageLocation: "",
  tracksBatch: false,
  fiscal: defaultProductFiscal,
  skipFiscalData: false,
  isResale: false,
  internalNotes: "",
  saleBlocked: false,
};

const defaultMachineDraft = (sectors: Sector[]): MachineDraft => ({
  name: "",
  sectorId: sectors[0]?.id ?? "",
  model: "",
  serialNumber: "",
  capacityPerHour: 0,
  costMonth: 0,
  nextMaintenanceAt: dateInputAfterDays(30),
  description: "",
});

const defaultMaintenanceDraft = (machines: Machine[], users: UserAccount[], machineId?: string): MaintenanceDraft => {
  const machine = machines.find((item) => item.id === machineId) ?? machines[0];
  const responsible = users.find((user) => user.type !== "CLIENT");

  return {
    machineId: machine?.id ?? "",
    assignedUserId: responsible?.id ?? "",
    priority: "HIGH",
    title: machine ? `Manutencao - ${machine.name}` : "Chamado de manutencao",
    description: machine ? `${machine.name} requer avaliacao tecnica.` : "",
    observations: "",
  };
};

const defaultExpenseDraft: ExpenseDraft = {
  label: "",
  type: "payable",
  value: 0,
  due: "Hoje",
  status: "Pendente",
  category: "Operacional",
  referenceType: "Geral",
  referenceId: "",
  paymentMethod: "Pix",
  notes: "",
};

const defaultFileDraft: FileDraft = {
  name: "",
  type: "Arte",
  linkedTo: "#1247",
  url: "",
  owner: "",
  notes: "",
};

const defaultQuoteDraft = (clients: Client[]): QuoteDraft => {
  const client = clients.find((item) => item.id === "cli-pixel") ?? clients[0];

  return {
    customerId: client?.id ?? "",
    contactName: client?.name ?? "",
    customerEmail: client?.email ?? "",
    customerPhone: client?.phone ?? "",
    responsible: "Carla Nunes",
    validUntil: dateInputAfterDays(7),
    issueDate: todayInputDate(),
    paymentCondition: "50% entrada + 50% entrega",
    productionDeadline: "5 dias úteis",
    discount: 0,
    discountType: "currency",
    notes: "Orçamento sujeito à disponibilidade de estoque e aprovação da arte final.",
    internalNotes: "",
    items: [],
  };
};

const inventoryImages: Record<string, string> = {
  "Vinil Branco": "/assets/category-stickers.jpg",
  "Caneta Metal": "/assets/category-mugs.jpg",
  "Lona 440g": "/assets/category-banners.jpg",
  "Camiseta Dry": "/assets/hero-design-studio.jpg",
  "Papel Couchê 300g": "/assets/category-business-cards.jpg",
};

const viewCopy: Record<ViewKey, { title: string; eyebrow: string }> = {
  dashboard: {
    title: "Olá, João! 👋",
    eyebrow: "Aqui está o resumo geral da sua gráfica hoje.",
  },
  orders: {
    title: "Pedidos",
    eyebrow: "Fila comercial com status, prazos e fracionamentos.",
  },
  production: {
    title: "Produção",
    eyebrow: "Itens por setor, prioridade e andamento operacional.",
  },
  clients: {
    title: "Clientes",
    eyebrow: "CRM com histórico, receita e contatos principais.",
  },
  users: {
    title: "Contatos",
    eyebrow: "Relacionamentos que impulsionam seu negócio.",
  },
  support: {
    title: "Atendimento",
    eyebrow: "Conversas, pedidos e orcamentos atendidos via WhatsApp.",
  },
  products: {
    title: "Produtos",
    eyebrow: "Cadastro operacional, mínimos de pedido e setores.",
  },
  catalog: {
    title: "Catálogo",
    eyebrow: "Vitrine interna pronta para montar pedidos rapidamente.",
  },
  inventory: {
    title: "Estoque",
    eyebrow: "Materiais, thresholds e alertas de reposição.",
  },
  machines: {
    title: "Máquinas",
    eyebrow: "Utilização, manutenção e custo mensal do maquinário.",
  },
  sectors: {
    title: "Setores",
    eyebrow: "Capacidade, SLA e carga de trabalho por área.",
  },
  landing: {
    title: "Landing Page",
    eyebrow: "Personalize a página pública da sua gráfica.",
  },
  quotes: {
    title: "Orçamentos",
    eyebrow: "Monte propostas, gere PDF e envie link público para aceite.",
  },
  finance: {
    title: "Financeiro",
    eyebrow: "Receitas, despesas, fluxo de caixa e margem.",
  },
  reports: {
    title: "Relatórios",
    eyebrow: "Indicadores consolidados para decisão executiva.",
  },
  files: {
    title: "Arquivos",
    eyebrow: "Artes, contratos, comprovantes e relatórios vinculados.",
  },
  notifications: {
    title: "Notificações",
    eyebrow: "Alertas operacionais, estoque, produção e financeiro.",
  },
  settings: {
    title: "Configurações",
    eyebrow: "Preferências, segurança, perfis e isolamento por tenant.",
  },
};

const iconByView: Record<ViewKey, LucideIcon> = {
  dashboard: Home,
  orders: ClipboardList,
  production: RefreshCw,
  clients: Users,
  users: UserCog,
  support: MessageCircle,
  products: Package,
  catalog: BookOpen,
  inventory: Warehouse,
  machines: Cpu,
  sectors: Layers3,
  landing: Globe,
  quotes: FileText,
  finance: WalletCards,
  reports: ArrowUpRight,
  files: Folder,
  notifications: Bell,
  settings: Settings,
};

type ViewTheme = { primary: string; secondary: string };

const sectionThemes: Record<string, ViewTheme> = {
  operation: { primary: "#236dff", secondary: "#4f46ff" },
  catalog: { primary: "#ff7a00", secondary: "#ff5500" },
  management: { primary: "#10b95b", secondary: "#08a841" },
};

const viewThemes: Record<ViewKey, ViewTheme> = {
  dashboard: { primary: "#5b45ff", secondary: "#7c4dff" },
  orders: sectionThemes.operation,
  production: sectionThemes.operation,
  clients: sectionThemes.management,
  users: sectionThemes.management,
  support: { primary: "#16b981", secondary: "#0f9f62" },
  products: sectionThemes.catalog,
  catalog: sectionThemes.catalog,
  inventory: sectionThemes.catalog,
  machines: sectionThemes.operation,
  sectors: sectionThemes.operation,
  landing: sectionThemes.management,
  quotes: sectionThemes.management,
  finance: sectionThemes.management,
  reports: { primary: "#236dff", secondary: "#5b45ff" },
  files: sectionThemes.catalog,
  notifications: { primary: "#ee3045", secondary: "#ff7a00" },
  settings: sectionThemes.management,
};

const navSections: Array<{ id: string; label: string; items: ViewKey[] }> = [
  {
    id: "operation",
    label: "Operação",
    items: ["orders", "production", "sectors", "machines"],
  },
  {
    id: "catalog",
    label: "Catálogo e recursos",
    items: ["products", "catalog", "inventory", "files"],
  },
  {
    id: "management",
    label: "Relacionamento e gestão",
    items: ["clients", "users", "quotes", "finance", "landing", "settings"],
  },
];

const topbarOverviewItems: ViewKey[] = ["dashboard", "reports", "support"];

const nextStatus: Record<OrderStatus, OrderStatus> = {
  approval: "payment",
  payment: "production",
  production: "conference",
  conference: "shipping",
  shipping: "delivered",
  delivered: "delivered",
  canceled: "canceled",
};

const defaultProductionStages: ProductionStage[] = [
  { id: "stage-approval", name: "Aprovação", status: "approval", color: "#5b45ff" },
  { id: "stage-payment", name: "Pagamento", status: "payment", color: "#fb920c" },
  { id: "stage-production", name: "Produção", status: "production", color: "#16b981" },
  { id: "stage-conference", name: "Conferência", status: "conference", color: "#0a84ff" },
  { id: "stage-shipping", name: "Expedição", status: "shipping", color: "#c026d3" },
  { id: "stage-delivered", name: "Entregues", status: "delivered", color: "#10a37f" },
];

const stagePalette = ["#5b45ff", "#0a84ff", "#16b981", "#fb920c", "#c026d3", "#ee3045"];

const financeEntryIcons: Record<FinanceEntry["type"], LucideIcon> = {
  receivable: CalendarDays,
  payable: CreditCard,
  profit: CircleDollarSign,
  margin: Percent,
  cash: WalletCards,
};

const QUOTE_DRAFT_STORAGE_KEY = "graphflow.quote.draft.v1";
const QUOTE_PUBLIC_LINKS_STORAGE_KEY = "graphflow.quote.public-links.v1";
const PROFILE_COMPLETION_NOTICE_KEY = "graphflow.profile-completion-notice.v1";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "graphflow.sidebarCollapsed";

function createClientId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function randomHex(bytes: number) {
  const values = new Uint8Array(bytes);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function createLocalDocumentNumber(prefix: string, existingNumbers: Array<string | undefined>) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const used = new Set(existingNumbers.filter((number): number is string => Boolean(number)));

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = `${prefix}-${date}-${randomHex(3)}`;
    if (!used.has(candidate)) return candidate;
  }

  return `${prefix}-${date}-${Date.now().toString(16).slice(-6).toUpperCase()}`;
}

function loadQuotePublicLinks(): Record<string, string> {
  if (typeof window === "undefined") return {};

  try {
    const saved = window.localStorage.getItem(QUOTE_PUBLIC_LINKS_STORAGE_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function rememberQuotePublicLink(quote: Quote) {
  if (typeof window === "undefined" || !quote.publicToken) return;

  try {
    const links = loadQuotePublicLinks();
    window.localStorage.setItem(
      QUOTE_PUBLIC_LINKS_STORAGE_KEY,
      JSON.stringify({
        ...links,
        [quote.id]: quote.publicToken,
      }),
    );
  } catch {
    // O link continua no estado atual mesmo se o navegador bloquear localStorage.
  }
}

function mergeQuotePublicLinks(quotes: Quote[]) {
  const links = loadQuotePublicLinks();
  return quotes.map((quote) => ({
    ...quote,
    publicToken: quote.publicToken || links[quote.id] || "",
  }));
}

const legacySeededQuoteItems: Record<string, Pick<QuoteItem, "quantity" | "unitPrice">> = {
  "quote-draft-folder": { quantity: 500, unitPrice: 1.2 },
  "quote-draft-card": { quantity: 1000, unitPrice: 0.35 },
  "quote-draft-banner": { quantity: 1, unitPrice: 85 },
};

function isLegacySeededQuoteDraft(draft: QuoteDraft) {
  if (draft.items.length !== Object.keys(legacySeededQuoteItems).length) return false;

  return draft.items.every((item) => {
    const legacyItem = legacySeededQuoteItems[item.id];
    return legacyItem && item.quantity === legacyItem.quantity && item.unitPrice === legacyItem.unitPrice;
  });
}

function loadSavedQuoteDraft(clients: Client[]): QuoteDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as QuoteDraft;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    const draft = {
      ...defaultQuoteDraft(clients),
      ...parsed,
    };

    return isLegacySeededQuoteDraft(draft) ? null : draft;
  } catch {
    return null;
  }
}

export function GraphFlowApp() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  });
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [dark, setDark] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authSessionUser, setAuthSessionUser] = useState<AuthSessionUser | null>(null);
  const [authChecking, setAuthChecking] = useState(() => graphflowApi.enabled());
  const [dataLoading, setDataLoading] = useState(false);
  const [dashboardOverview, setDashboardOverview] = useState<DashboardOverview | null>(null);
  const [managementReport, setManagementReport] = useState<ManagementReport | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [productionStages, setProductionStages] =
    useState<ProductionStage[]>(defaultProductionStages);
  const [productionStageFocusSignal, setProductionStageFocusSignal] = useState(0);
  const [finance, setFinance] = useState<FinanceEntry[]>([]);
  const [payments, setPayments] = useState<PaymentTransactionRecord[]>([]);
  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [orderDraft, setOrderDraft] = useState<NewOrderDraft>(() =>
    defaultOrderDraft([], []),
  );
  const [clientDraft, setClientDraft] = useState<ClientDraft>(defaultClientDraft);
  const [userDraft, setUserDraft] = useState<UserDraft>(defaultUserDraft);
  const [productDraft, setProductDraft] =
    useState<ProductDraft>(defaultProductDraft);
  const [machineDraft, setMachineDraft] = useState<MachineDraft>(() =>
    defaultMachineDraft([]),
  );
  const [maintenanceDraft, setMaintenanceDraft] = useState<MaintenanceDraft>(() =>
    defaultMaintenanceDraft([], []),
  );
  const [expenseDraft, setExpenseDraft] =
    useState<ExpenseDraft>(defaultExpenseDraft);
  const [fileDraft, setFileDraft] = useState<FileDraft>(defaultFileDraft);
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>(() =>
    defaultQuoteDraft([]),
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const addToast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = createClientId("tst");
    setToasts((current) => [...current, { id, ...item }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const createNotification = useCallback((item: Omit<NotificationItem, "id" | "read" | "time"> & { silent?: boolean }) => {
    const fields = normalizeNotificationFields(item.fields ?? extractNotificationFields(item.message));
    const { silent, ...rest } = item;
    setNotifications((current) => [
      {
        id: createClientId("not"),
        time: "agora",
        read: false,
        ...rest,
        fields,
      },
      ...current,
    ]);
    if (!silent) {
      addToast({ ...rest, fields });
    }
  }, [addToast]);

  function normalizeNotificationFields(fields?: string[]) {
    const unique = Array.from(new Set((fields ?? []).map((field) => field.trim()).filter(Boolean)));
    return unique.length > 0 ? unique : undefined;
  }

  function extractNotificationFieldsFromMessage(message: string) {
    return normalizeNotificationFields(extractNotificationFields(message));
  }

  function productToDraft(product: Product): ProductDraft {
    return {
      sku: product.sku ?? product.id,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory ?? "",
      sector: product.sector,
      machineId: product.machineId ?? "",
      description: product.description ?? "",
      commercialDescription: product.commercialDescription ?? product.name,
      complementaryDescription: product.complementaryDescription ?? "",
      gtin: product.gtin ?? "SEM GTIN",
      brand: product.brand ?? "",
      thumbnailUrl: product.thumbnailUrl ?? "",
      availableColorsText: (product.availableColors?.length ? product.availableColors : DEFAULT_PRODUCT_COLORS).join(", "),
      price: product.price,
      costPrice: product.costPrice ?? 0,
      markupPercent: product.markupPercent ?? 0,
      minSalePrice: product.minSalePrice ?? 0,
      priceTable: product.priceTable ?? "",
      minOrderQty: product.minOrderQty,
      minFractionQty: product.minFractionQty,
      allowsFractions: product.allowsFractions,
      stockItem: product.stockItem,
      stockQty: product.stockQty ?? 0,
      stockMin: product.stockMin ?? 0,
      stockUnit: product.stockUnit ?? "UN",
      commercialUnit: product.commercialUnit ?? "UN",
      conversionFactor: product.conversionFactor ?? "",
      netWeightKg: product.netWeightKg ?? "",
      grossWeightKg: product.grossWeightKg ?? "",
      packageDimensionsCm: product.packageDimensionsCm ?? "",
      storageLocation: product.storageLocation ?? "",
      tracksBatch: product.tracksBatch ?? false,
      fiscal: { ...defaultProductFiscal, ...(product.fiscal ?? {}) },
      skipFiscalData: !productHasFiscalData(product),
      isResale: product.isResale ?? false,
      internalNotes: product.internalNotes ?? "",
      saleBlocked: product.saleBlocked ?? false,
    };
  }

  function stagesFromSectors(remoteSectors: Sector[]): ProductionStage[] {
    return [...remoteSectors]
      .sort((a, b) => a.order - b.order)
      .map((sector, index) => ({
        id: sector.id,
        name: sector.name,
        color: stagePalette[index % stagePalette.length],
      }));
  }

  const refreshWorkspace = useCallback(async () => {
    if (!graphflowApi.enabled()) return;

    try {
      setDataLoading(true);
      const [workspace, overview, report] = await Promise.all([
        graphflowApi.loadWorkspace(),
        graphflowApi.dashboardOverview().catch(() => null),
        graphflowApi.managementReport().catch(() => null),
      ]);

      setClients(workspace.clients);
      setUsers(workspace.users);
      setProducts(workspace.products);
      setInventory(workspace.inventory);
      setMachines(workspace.machines);
      setSectors(workspace.sectors);
      setProductionStages(stagesFromSectors(workspace.sectors));
      setOrders(workspace.orders);
      setQuotes(mergeQuotePublicLinks(workspace.quotes));
      setFinance(workspace.finance);
      setPayments(workspace.payments);
      setFiles(workspace.files);
      setNotifications(workspace.notifications);
      setOrderDraft(defaultOrderDraft(workspace.products, workspace.clients));
      setQuoteDraft(loadSavedQuoteDraft(workspace.clients) ?? defaultQuoteDraft(workspace.clients));
      setDashboardOverview(overview);
      setManagementReport(report);
    } catch (error) {
      createNotification({
        tone: "danger",
        title: "Falha ao carregar dados",
        message: error instanceof Error ? error.message : "Nao foi possivel consultar o backend.",
      });
    } finally {
      setDataLoading(false);
    }
  }, [createNotification]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    try {
      window.localStorage.setItem(QUOTE_DRAFT_STORAGE_KEY, JSON.stringify(quoteDraft));
    } catch {
      // Autosave local nao deve interromper o preenchimento do orcamento.
    }
  }, [quoteDraft]);

  useEffect(() => {
    function syncAcceptedQuotes() {
      try {
        const acceptances = JSON.parse(
          window.localStorage.getItem(QUOTE_ACCEPTANCE_KEY) ?? "{}",
        ) as Record<string, { token: string; acceptedAt: string }>;

        setQuotes((current) =>
          current.map((quote) => {
            const acceptance = acceptances[quote.id];

            if (!acceptance || acceptance.token !== quote.publicToken || quote.status === "Aceito") {
              return quote;
            }

            return { ...quote, status: "Aceito", acceptedAt: acceptance.acceptedAt };
          }),
        );
      } catch {
        // Aceites externos não devem bloquear o uso do painel.
      }
    }

    syncAcceptedQuotes();
    window.addEventListener("focus", syncAcceptedQuotes);
    document.addEventListener("visibilitychange", syncAcceptedQuotes);

    return () => {
      window.removeEventListener("focus", syncAcceptedQuotes);
      document.removeEventListener("visibilitychange", syncAcceptedQuotes);
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!graphflowApi.enabled()) {
      return;
    }

    let active = true;

    graphflowApi
      .session()
      .then(async (session) => {
        if (active) {
          setAuthUserId(session.user.id);
          setAuthSessionUser({
            id: session.user.id,
            tenantId: session.user.tenantId,
            email: session.user.email,
            role: session.user.role,
          });
          setAuthenticated(true);
          await refreshWorkspace();
        }
      })
      .catch(() => {
        if (active) {
          setAuthenticated(false);
          setAuthSessionUser(null);
        }
        /*
        createNotification({
          tone: "warning",
          title: "Backend indisponível",
          message: error instanceof Error ? error.message : "Clientes locais serão usados nesta sessão.",
        });
        */
      })
      .finally(() => {
        if (active) {
          setAuthChecking(false);
        }
      });

    graphflowApi
      .dashboardOverview()
      .then((overview) => {
        if (active) {
          setDashboardOverview(overview);
        }
      })
      .catch(() => {
        if (active) {
          setDashboardOverview(null);
        }
      });

    graphflowApi
      .managementReport()
      .then((report) => {
        if (active) {
          setManagementReport(report);
        }
      })
      .catch(() => {
        if (active) {
          setManagementReport(null);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!authenticated || !authUserId || !users.length) {
      return;
    }

    const currentUser = users.find((user) => user.id === authUserId || user.email === authUserId);

    if (!currentUser || currentUser.profileComplete) {
      return;
    }

    let shouldNotify = false;

    try {
      const notified = JSON.parse(
        window.localStorage.getItem(PROFILE_COMPLETION_NOTICE_KEY) ?? "{}",
      ) as Record<string, boolean>;

      if (notified[currentUser.id]) {
        return;
      }

      window.localStorage.setItem(
        PROFILE_COMPLETION_NOTICE_KEY,
        JSON.stringify({ ...notified, [currentUser.id]: true }),
      );

      shouldNotify = true;
    } catch {
      shouldNotify = true;
    }

    if (!shouldNotify) {
      return;
    }

    const noticeTimer = window.setTimeout(() => {
      createNotification({
        tone: "info",
        silent: true,
        title: "Complete seu cadastro",
        message: "Revise telefone, endereco, setor e dados operacionais para liberar o perfil completo.",
      });
    }, 0);

    return () => {
      window.clearTimeout(noticeTimer);
    };
  }, [authenticated, authUserId, users, createNotification]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === orderDraft.productId),
    [orderDraft.productId, products],
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === orderDraft.customerId),
    [clients, orderDraft.customerId],
  );

  const orderItemProducts = useMemo(
    () =>
      orderDraft.items
        .map((item) => ({
          item,
          product: products.find((product) => product.id === item.productId),
        }))
        .filter((entry): entry is { item: NewOrderItem; product: Product } => Boolean(entry.product)),
    [orderDraft.items, products],
  );

  const orderTotal = orderItemProducts.reduce(
    (total, { item, product }) => total + calculateOrderTotal(product, item.quantity),
    0,
  );
  const fractionTotal = sumFractions(orderDraft.fractions);

  const orderValidation = useMemo(() => {
    if (!selectedClient) {
      return "Selecione um cliente válido.";
    }

    if (orderItemProducts.length === 0) {
      return "Adicione pelo menos um item ao pedido.";
    }

    const invalidItem = orderItemProducts.find(({ item, product }) => item.quantity < product.minOrderQty);
    if (invalidItem) {
      return `Quantidade mínima de ${invalidItem.product.name}: ${formatNumber(invalidItem.product.minOrderQty)}.`;
    }

    if (orderItemProducts.some(({ item }) => item.quantity <= 0)) {
      return "Todos os itens precisam ter quantidade válida.";
    }

    if (orderDraft.deliveryDate && orderDraft.deliveryDate < todayInputDate()) {
      return "A entrega precisa ser hoje ou uma data futura.";
    }

    if (orderDraft.fractions.length === 0) {
      return null;
    }

    if (!selectedProduct) {
      return "Selecione um produto válido.";
    }

    if (!selectedProduct.allowsFractions) {
      return "Este produto não permite fracionamento.";
    }

    if (fractionTotal !== orderDraft.quantity) {
      return `A soma das frações (${formatNumber(fractionTotal)}) deve ser igual à quantidade total (${formatNumber(orderDraft.quantity)}).`;
    }

    const invalidFractionIndex = orderDraft.fractions.findIndex((fraction) => {
      const quantity = Number(fraction.quantity);
      return (
        quantity < selectedProduct.minFractionQty ||
        quantity % selectedProduct.minFractionQty !== 0
      );
    });

    if (invalidFractionIndex >= 0) {
      const invalidFraction = orderDraft.fractions[invalidFractionIndex];
      return `Fração ${invalidFractionIndex + 1} (${formatNumber(invalidFraction.quantity)}) deve ter no mínimo ${formatNumber(selectedProduct.minFractionQty)} e ser múltipla desse valor.`;
    }

    return null;
  }, [
    fractionTotal,
    orderDraft.deliveryDate,
    orderDraft.fractions,
    orderDraft.quantity,
    orderItemProducts,
    selectedClient,
    selectedProduct,
  ]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => orderMatchesQuery(order, query) && orderMatchesDateFilter(order, dateFilter)),
    [orders, query, dateFilter],
  );

  const filteredProducts = useMemo(
    () => products.filter((product) => productMatchesQuery(product, query)),
    [products, query],
  );

  const filteredClients = useMemo(() => {
    const normalized = normalizeText(query);
    return clients.filter((client) =>
      normalizeText(`${client.name} ${client.company} ${client.email} ${client.city}`).includes(
        normalized,
      ),
    );
  }, [clients, query]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const currentCopy = viewCopy[view];
  const currentTheme = viewThemes[view];
  const appThemeStyle = {
    "--primary": currentTheme.primary,
    "--primary-2": currentTheme.secondary,
    "--screen-tone": currentTheme.primary,
    "--screen-tone-2": currentTheme.secondary,
  } as CSSProperties;

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  function openModal(mode: Exclude<ModalMode, null>) {
    if (mode === "order-detail" || mode === "quote-detail") {
      setModalMode(mode);
      return;
    }

    if (mode === "order") {
      setOrderDraft(defaultOrderDraft(products, clients));
    }
    if (mode === "client") {
      setClientDraft(defaultClientDraft);
    }
    if (mode === "user") {
      setUserDraft(defaultUserDraft);
    }
    if (mode === "product") {
      setProductDraft(defaultProductDraft);
      setEditingProductId(null);
    }
    if (mode === "machine") {
      setMachineDraft(defaultMachineDraft(sectors));
    }
    if (mode === "maintenance") {
      setMaintenanceDraft(defaultMaintenanceDraft(machines, users));
    }
    if (mode === "expense") {
      setExpenseDraft(defaultExpenseDraft);
    }
    if (mode === "quote") {
      setQuoteDraft(defaultQuoteDraft(clients));
      setView("quotes");
    }
    if (mode === "file") {
      setFileDraft(defaultFileDraft);
    }

    setModalMode(mode);
  }

  function closeModal() {
    setModalMode(null);
    setSelectedOrderId(null);
    setSelectedQuoteId(null);
    setEditingProductId(null);
  }

  function openProductEdit(productId: string) {
    const product = products.find((item) => item.id === productId);

    if (!product) {
      return;
    }

    setEditingProductId(product.id);
    setProductDraft(productToDraft(product));
    setModalMode("product-edit");
  }

  async function uploadFile(file: File, scope: UploadScope): Promise<UploadedFile> {
    if (file.size > UPLOAD_MAX_BYTES) {
      const message = `${file.name} tem ${formatFileSize(file.size)}. O limite atual é ${UPLOAD_MAX_LABEL}.`;
      createNotification({
        tone: "warning",
        title: "Arquivo muito grande",
        message,
      });
      throw new Error(message);
    }

    if (graphflowApi.enabled()) {
      try {
        const uploaded = await graphflowApi.uploadFile(file, scope);
        createNotification({
          tone: "success",
          title: "Upload concluido",
          message: `${uploaded.name} foi enviado com seguranca para o storage.`,
        });
        return uploaded;
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Upload nao enviado",
          message: error instanceof Error ? error.message : "Nao foi possivel enviar o arquivo.",
        });
        throw error;
      }
    }

    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Nao foi possivel ler o arquivo."));
      reader.readAsDataURL(file);
    });

    return {
      url,
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    };
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (orderValidation || !selectedClient || orderItemProducts.length === 0) {
      return;
    }

    const primaryItem = orderItemProducts[0].item;
    const primaryProduct = orderItemProducts[0].product;
    const assignedMachine = machines.find((machine) => machine.sector === primaryProduct.sector);
    const selectedSector = sectors.find((sector) => sector.name === primaryProduct.sector);
    const totalQuantity = orderItemProducts.reduce((total, { item }) => total + item.quantity, 0);
    const orderProductLabel =
      orderItemProducts.length === 1
        ? primaryProduct.name
        : `${primaryProduct.name} + ${orderItemProducts.length - 1} item(s)`;

    if (graphflowApi.enabled()) {
      try {
        const nextOrder = await graphflowApi.createOrder(
          {
            customerId: selectedClient.id,
            product: primaryProduct,
            quantity: primaryItem.quantity,
            deliveryDate: orderDraft.deliveryDate,
            machineId: assignedMachine?.id,
            sectorId: selectedSector?.id,
            items: orderItemProducts.map(({ item, product }) => {
              const productMachine = machines.find((machine) => machine.sector === product.sector);
              const productSector = sectors.find((sector) => sector.name === product.sector);
              return {
                product,
                quantity: item.quantity,
                machineId: productMachine?.id,
                sectorId: productSector?.id,
              };
            }),
          },
          clients,
          products,
          sectors,
        );
        setOrders((current) => [nextOrder, ...current]);
        if (orderDraft.artFileName.trim()) {
          await graphflowApi.createFile({
            name: orderDraft.artFileName.trim(),
            type: "Arte",
            linkedTo: `${nextOrder.number ?? nextOrder.id} · ${primaryProduct.name}`,
            size: "arquivo externo",
            url: orderDraft.artFileUrl.trim() || undefined,
          }).catch(() => null);
        }
        await refreshWorkspace();
        createNotification({
          tone: "info",
          title: "Novo pedido criado",
          message: `${nextOrder.number ?? nextOrder.id} para ${selectedClient.name} entrou em producao.`,
        });
        setOrderDraft(defaultOrderDraft(products, clients));
        window.localStorage.removeItem("graphflow.orderDraft.manual");
        setModalMode(null);
        setView("orders");
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Pedido nao salvo",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    const nextNumber = createLocalDocumentNumber("PED", orders.map((order) => order.number ?? order.id));
    const nextOrder: Order = {
      id: nextNumber,
      number: nextNumber,
      customer: selectedClient.name,
      product: orderProductLabel,
      productId: primaryProduct.id,
      sector: primaryProduct.sector,
      machineId: assignedMachine?.id,
      responsible: "Carla Nunes",
      quantity: totalQuantity,
      total: orderTotal,
      status: "approval",
      progress: 5,
      delivery: formatShortDate(orderDraft.deliveryDate),
      dueDate: orderDraft.deliveryDate,
      priority: orderTotal > 3000 ? "Alta" : "Média",
      fractions: orderDraft.fractions.map((fraction, index) => ({
        ...fraction,
        id: `${nextNumber}-fraction-${index}`,
      })),
      artFiles: orderDraft.artFileName.trim()
        ? [
            {
              id: `art-${Date.now()}`,
              productName: primaryProduct.name,
              name: orderDraft.artFileName.trim(),
              url: orderDraft.artFileUrl.trim() || "#",
              size: "arquivo externo",
            },
          ]
        : orderItemProducts
            .filter(({ item }) => item.artFileName.trim())
            .map(({ item, product }, index) => ({
              id: `art-${Date.now()}-${index}`,
              productName: product.name,
              name: item.artFileName.trim(),
              url: item.artFileUrl.trim() || "#",
              size: "arquivo externo",
            })),
    };

    setOrders((current) => [nextOrder, ...current]);
    setClients((current) =>
      current.map((client) =>
        client.id === selectedClient.id
          ? {
              ...client,
              orders: client.orders + 1,
              revenue: client.revenue + orderTotal,
              status: "Ativo",
            }
          : client,
      ),
    );
    setInventory((current) =>
      current.map((inventoryItem) => {
        const matchingItems = orderItemProducts.filter(
          ({ product }) => product.stockItem === inventoryItem.name,
        );
        if (matchingItems.length === 0) {
          return inventoryItem;
        }

        const usedQuantity = matchingItems.reduce(
          (total, { item }) => total + Math.ceil(item.quantity / 100),
          0,
        );
        return {
          ...inventoryItem,
          quantity: Math.max(0, inventoryItem.quantity - usedQuantity),
          lastMove: "agora",
        };
      }),
    );
    setSectors((current) =>
      current.map((sector) => {
        const sectorItems = orderItemProducts.filter(({ product }) => product.sector === sector.name);
        if (sectorItems.length === 0) {
          return sector;
        }

        return {
          ...sector,
          orders: sector.orders + 1,
          capacity: Math.min(100, sector.capacity + sectorItems.length * 3),
        };
      }),
    );
    setFinance((current) =>
      current.map((entry) =>
        entry.type === "receivable"
          ? { ...entry, value: entry.value + orderTotal, status: "Pendente" }
          : entry,
      ),
    );
    createNotification({
      tone: "info",
      title: "Novo pedido criado",
      message: `${nextOrder.id} para ${selectedClient.name} entrou em aprovação.`,
    });
    setOrderDraft(defaultOrderDraft(products, clients));
    window.localStorage.removeItem("graphflow.orderDraft.manual");
    setModalMode(null);
    setView("orders");
  }

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!clientDraft.name.trim() || !clientDraft.email.includes("@") || !clientDraft.document.trim()) {
      return;
    }

    let nextClient: Client;

    if (graphflowApi.enabled()) {
      try {
        nextClient = await graphflowApi.createClient({
          personType: clientDraft.personType,
          documentType: clientDraft.documentType,
          document: clientDraft.document,
          name: clientDraft.name,
          companyName: clientDraft.company,
          email: clientDraft.email,
          phone: clientDraft.phone,
          whatsapp: clientDraft.whatsapp,
          avatarUrl: clientDraft.avatarUrl,
          addressZip: clientDraft.addressZip,
          addressStreet: clientDraft.addressStreet,
          addressNumber: clientDraft.addressNumber,
          addressComplement: clientDraft.addressComplement,
          addressDistrict: clientDraft.addressDistrict,
          addressCity: clientDraft.addressCity,
          addressState: clientDraft.addressState,
          addressCountry: "BR",
          notes: clientDraft.notes,
        });
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Cliente não salvo",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
        return;
      }
    } else {
      nextClient = {
        id: `cli-${Date.now()}`,
        personType: clientDraft.personType,
        documentType: clientDraft.documentType,
        document: clientDraft.document,
        name: clientDraft.name,
        company: clientDraft.company,
        email: clientDraft.email,
        phone: clientDraft.phone,
        whatsapp: clientDraft.whatsapp,
        city: clientDraft.addressCity,
        avatarUrl: clientDraft.avatarUrl,
        address: {
          zip: clientDraft.addressZip,
          street: clientDraft.addressStreet,
          number: clientDraft.addressNumber,
          complement: clientDraft.addressComplement,
          district: clientDraft.addressDistrict,
          city: clientDraft.addressCity,
          state: clientDraft.addressState,
          country: "BR",
        },
        notes: clientDraft.notes,
        orders: 0,
        revenue: 0,
        status: "Ativo",
      };
    }

    setClients((current) => [nextClient, ...current]);
    createNotification({
      tone: "success",
      title: "Cliente cadastrado",
      message: `${nextClient.name} foi adicionado ao CRM.`,
    });
    setClientDraft(defaultClientDraft);
    setModalMode(null);
    setView("clients");
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userDraft.name.trim() || !userDraft.email.includes("@")) {
      return;
    }

    try {
      const nextUser = await graphflowApi.createUser({
        type: userDraft.type,
        name: userDraft.name,
        email: userDraft.email,
        phone: userDraft.phone,
        document: userDraft.document,
        avatarUrl: userDraft.avatarUrl,
        role: userDraft.role,
        permissions: userDraft.permissions,
        sectorIds: userDraft.sectorIds,
        password: userDraft.password || undefined,
        status: "Ativo",
      });
      setUsers((current) => [nextUser, ...current]);
      await refreshWorkspace();
      createNotification({
        tone: "success",
        title: "Usuario cadastrado",
        message: `${nextUser.name} recebeu acesso ao painel.`,
      });
      setModalMode(null);
      setView("users");
    } catch (error) {
      createNotification({
        tone: "danger",
        title: "Usuario nao salvo",
        message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
      });
    }
  }

  async function deleteUser(userId: string) {
    const user = users.find((item) => item.id === userId);
    if (!user) return;

    try {
      await graphflowApi.deleteUser(userId);
      setUsers((current) => current.filter((item) => item.id !== userId));
      await refreshWorkspace();
      createNotification({
        tone: "info",
        title: "Usuario removido",
        message: `${user.name} foi removido do painel.`,
      });
    } catch (error) {
      createNotification({
        tone: "danger",
        title: "Usuario nao removido",
        message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
      });
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateProductFiscalDraft(productDraft);
    const missingFields = [...validation.missing];
    if (!productDraft.name.trim()) missingFields.unshift("Nome do produto");
    if (!Number.isFinite(productDraft.price) || productDraft.price <= 0) missingFields.unshift("Preço de venda (maior que 0)");

    if (missingFields.length > 0 || validation.invalid.length > 0) {
      createNotification({
        tone: "warning",
        title: "Não foi possível salvar o produto",
        message: `Revise os campos: ${[...missingFields, ...validation.invalid].join("; ")}`,
        fields: normalizeNotificationFields([...missingFields, ...validation.invalid]),
      });
      return;
    }

    const nextProduct = productFromDraft(productDraft, `prod-${Date.now()}`);

    if (graphflowApi.enabled()) {
      try {
        const selectedSector = sectors.find((sector) => sector.name === productDraft.sector);
        const savedProduct = await graphflowApi.createProduct(nextProduct, selectedSector?.id);
        setProducts((current) => [savedProduct, ...current]);
        await refreshWorkspace();
        createNotification({
          tone: "success",
          title: "Produto cadastrado",
          message: `${savedProduct.name} está disponível no catálogo.`,
        });
        setModalMode(null);
        setView("products");
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Produto nao salvo",
          message:
            error instanceof Error && /Entrada invalida/i.test(error.message)
              ? `${error.message} Verifique nome, SKU, categoria, preço e dados fiscais.`
              : error instanceof Error
                ? error.message
                : "Falha ao conectar com o backend.",
          fields:
            error instanceof GraphflowApiError && error.issues.length
              ? normalizeNotificationFields(error.issues.map((issue) => issue.field))
              : normalizeNotificationFields([...missingFields, ...validation.invalid]),
        });
      }
      return;
    }

    setProducts((current) => [nextProduct, ...current]);
    createNotification({
      tone: "success",
      title: "Produto cadastrado",
      message: `${nextProduct.name} está disponível no catálogo.`,
    });
    setModalMode(null);
    setView("products");
  }

  async function saveProductEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateProductFiscalDraft(productDraft);
    const missingFields = [...validation.missing];
    if (!productDraft.name.trim()) missingFields.unshift("Nome do produto");
    if (!Number.isFinite(productDraft.price) || productDraft.price <= 0) missingFields.unshift("Preço de venda (maior que 0)");

    if (!editingProductId || missingFields.length > 0 || validation.invalid.length > 0) {
      createNotification({
        tone: "warning",
        title: "Não foi possível salvar a edição",
        message: !editingProductId ? "Erro interno (sem ID de edição)" : `Revise os campos: ${[...missingFields, ...validation.invalid].join("; ")}`,
        fields: normalizeNotificationFields([...missingFields, ...validation.invalid]),
      });
      return;
    }

    const selectedSector = sectors.find((sector) => sector.name === productDraft.sector);

    if (graphflowApi.enabled()) {
      try {
        const savedProduct = await graphflowApi.updateProduct(
          editingProductId,
          productFromDraft(productDraft, editingProductId),
          selectedSector?.id,
        );
        setProducts((current) =>
          current.map((product) => (product.id === editingProductId ? savedProduct : product)),
        );
        await refreshWorkspace();
        createNotification({
          tone: "success",
          title: "Produto atualizado",
          message: `${savedProduct.name} foi salvo no catalogo.`,
        });
        closeModal();
        setView("products");
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Produto nao atualizado",
          message:
            error instanceof Error && /Entrada invalida/i.test(error.message)
              ? `${error.message} Verifique nome, SKU, categoria, preço e dados fiscais.`
              : error instanceof Error
                ? error.message
                : "Falha ao conectar com o backend.",
          fields:
            error instanceof GraphflowApiError && error.issues.length
              ? normalizeNotificationFields(error.issues.map((issue) => issue.field))
              : normalizeNotificationFields([...missingFields, ...validation.invalid]),
        });
      }
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === editingProductId
          ? {
              ...product,
              ...productFromDraft(productDraft, editingProductId),
            }
          : product,
      ),
    );
    createNotification({
      tone: "success",
      title: "Produto atualizado",
      message: `${productDraft.name} foi salvo no catalogo.`,
    });
    closeModal();
    setView("products");
  }

  async function deleteProduct(productId: string) {
    const product = products.find((item) => item.id === productId);

    if (!product) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.deleteProduct(productId);
        setProducts((current) => current.filter((item) => item.id !== productId));
        await refreshWorkspace();
        createNotification({
          tone: "info",
          title: "Produto removido",
          message: `${product.name} foi desativado no catalogo.`,
        });
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Produto nao removido",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setProducts((current) => current.filter((item) => item.id !== productId));
    createNotification({
      tone: "info",
      title: "Produto removido",
      message: `${product.name} foi retirado do catalogo.`,
    });
  }

  async function createExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!expenseDraft.label.trim() || expenseDraft.value <= 0) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        const savedEntry = await graphflowApi.createFinanceEntry({
          label: expenseDraft.label,
          type: expenseDraft.type,
          value: expenseDraft.value,
          due: expenseDraft.due,
          status: expenseDraft.status,
          category: expenseDraft.category,
          referenceType: expenseDraft.referenceType,
          referenceId: expenseDraft.referenceId,
          paymentMethod: expenseDraft.paymentMethod,
          notes: expenseDraft.notes,
        });
        setFinance((current) => [savedEntry, ...current]);
        await refreshWorkspace();
        createNotification({
          tone: "warning",
          title: "Despesa registrada",
          message: `${expenseDraft.label} entrou no contas a pagar.`,
        });
        setModalMode(null);
        setView("finance");
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Despesa nao salva",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setFinance((current) => [
      {
        id: `fin-${Date.now()}`,
        label: expenseDraft.label,
        type: expenseDraft.type,
        value: expenseDraft.value,
        due: expenseDraft.due,
        status: expenseDraft.status,
        category: expenseDraft.category,
        referenceType: expenseDraft.referenceType,
        referenceId: expenseDraft.referenceId,
        paymentMethod: expenseDraft.paymentMethod,
        notes: expenseDraft.notes,
      },
      ...current,
    ]);
    createNotification({
      tone: "warning",
      title: "Despesa registrada",
      message: `${expenseDraft.label} entrou no contas a pagar.`,
    });
    setModalMode(null);
    setView("finance");
  }

  function scheduleCharge() {
    createNotification({
      tone: "info",
      title: "Cobrança agendada",
      message: "A cobrança de contas a receber foi adicionada à rotina financeira.",
    });
  }

  function sendPaymentReminder() {
    createNotification({
      tone: "success",
      title: "Lembrete enviado",
      message: "O lembrete financeiro foi preparado para envio ao cliente.",
    });
  }

  async function createFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fileDraft.name.trim()) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        const savedFile = await graphflowApi.createFile({
          name: fileDraft.name,
          type: fileDraft.type,
          linkedTo: fileDraft.linkedTo,
          url: fileDraft.url,
          owner: fileDraft.owner,
          notes: fileDraft.notes,
          size: "2.4 MB",
        });
        setFiles((current) => [savedFile, ...current]);
        await refreshWorkspace();
        createNotification({
          tone: "success",
          title: "Arquivo enviado",
          message: `${fileDraft.name} foi anexado com sucesso.`,
        });
        setModalMode(null);
        setView("files");
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Arquivo nao salvo",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setFiles((current) => [
      {
        id: `file-${Date.now()}`,
        name: fileDraft.name,
        type: fileDraft.type,
        linkedTo: fileDraft.linkedTo,
        url: fileDraft.url,
        owner: fileDraft.owner,
        notes: fileDraft.notes,
        size: "2.4 MB",
        updatedAt: "agora",
      },
      ...current,
    ]);
    createNotification({
      tone: "success",
      title: "Arquivo enviado",
      message: `${fileDraft.name} foi anexado com sucesso.`,
    });
    setModalMode(null);
    setView("files");
  }

  async function updateFile(fileId: string, update: Partial<Omit<FileItem, "id" | "updatedAt">>) {
    if (graphflowApi.enabled()) {
      try {
        const savedFile = await graphflowApi.updateFile(fileId, update);
        setFiles((current) => current.map((file) => (file.id === fileId ? savedFile : file)));
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Arquivo nao atualizado",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setFiles((current) => current.map((file) => (file.id === fileId ? { ...file, ...update, updatedAt: "agora" } : file)));
  }

  async function deleteFile(fileId: string) {
    const file = files.find((item) => item.id === fileId);
    if (!file) return;

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.deleteFile(fileId);
        setFiles((current) => current.filter((item) => item.id !== fileId));
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Arquivo nao removido",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setFiles((current) => current.filter((item) => item.id !== fileId));
  }

  async function updateOrderStatus(orderId: string) {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;

    const status = nextStatus[order.status];

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.updateOrderStatus(orderId, status);
        setOrders((current) =>
          current.map((item) =>
            item.id === orderId
              ? {
                  ...item,
                  status,
                  stageId: undefined,
                  progress: status === "delivered" ? 100 : Math.min(95, item.progress + 18),
                }
              : item,
          ),
        );
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Pedido nao atualizado",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        const status = nextStatus[order.status];
        const progress = status === "delivered" ? 100 : Math.min(95, order.progress + 18);

        return { ...order, status, stageId: undefined, progress };
      }),
    );
  }

  async function moveOrderToProductionStage(orderId: string, stageId: string) {
    const stage = productionStages.find((item) => item.id === stageId);
    const order = orders.find((item) => item.id === orderId);

    if (!stage || !order) {
      return;
    }

    if (graphflowApi.enabled() && order.itemId) {
      try {
        await graphflowApi.moveOrderItem(order.itemId, {
          status: stage.status ?? "production",
          stageId: stage.id,
          machineId: order.machineId,
        });
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Pedido nao movimentado",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        if (stage.status) {
          return {
            ...order,
            status: stage.status,
            stageId: undefined,
            progress: stage.status === "delivered" ? 100 : order.progress,
          };
        }

        return { ...order, stageId: stage.id };
      }),
    );
  }

  function openOrderDetail(orderId: string) {
    setSelectedOrderId(orderId);
    setModalMode("order-detail");
  }

  function openQuoteDetail(quoteId: string) {
    setSelectedQuoteId(quoteId);
    setModalMode("quote-detail");
  }

  function convertQuoteToOrder(quote: Quote) {
    const today = new Date();
    const delivery = new Date();
    delivery.setDate(today.getDate() + 5);

    setOrderDraft({
      ...defaultOrderDraft(products, clients),
      customerId: quote.customerId,
      orderDate: today.toISOString().split('T')[0],
      deliveryDate: delivery.toISOString().split('T')[0],
      notes: "Convertido a partir do Orçamento " + quote.id,
      items: quote.items.map((item, index) => ({
        id: "item-" + Date.now() + "-" + index,
        productId: item.productId,
        quantity: item.quantity,
        note: "Produto: " + item.productName,
        artFileName: item.attachmentName || "",
        artFileUrl: item.attachmentUrl || ""
      }))
    });
    setModalMode("order");
  }

  async function createProductionStage(name: string) {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        const sector = await graphflowApi.createSector(trimmed);
        setSectors((current) => [sector, ...current]);
        setProductionStages(stagesFromSectors([sector, ...sectors]));
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Estagio nao salvo",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setProductionStages((current) => [
      ...current,
      {
        id: `stage-${Date.now()}`,
        name: trimmed,
        color: stagePalette[current.length % stagePalette.length],
      },
    ]);
  }

  async function renameProductionStage(stageId: string, name: string) {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        const updated = await graphflowApi.updateSector(stageId, { name: trimmed });
        setSectors((current) => current.map((sector) => (sector.id === stageId ? updated : sector)));
        setProductionStages((current) =>
          current.map((stage) => (stage.id === stageId ? { ...stage, name: updated.name } : stage)),
        );
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Estagio nao atualizado",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setProductionStages((current) =>
      current.map((stage) => (stage.id === stageId ? { ...stage, name: trimmed } : stage)),
    );
  }

  async function removeProductionStage(stageId: string) {
    const stageToRemove = productionStages.find((stage) => stage.id === stageId);
    const fallbackStage = productionStages.find((stage) => stage.id !== stageId);

    if (!stageToRemove || !fallbackStage || productionStages.length <= 1) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.deleteSector(stageId);
        setProductionStages((current) => current.filter((stage) => stage.id !== stageId));
        setSectors((current) => current.filter((sector) => sector.id !== stageId));
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Estagio nao removido",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setOrders((current) =>
      current.map((order) => {
        const belongsToStage = stageToRemove.status
          ? !order.stageId && order.status === stageToRemove.status
          : order.stageId === stageToRemove.id;

        if (!belongsToStage) {
          return order;
        }

        if (fallbackStage.status) {
          return {
            ...order,
            status: fallbackStage.status,
            stageId: undefined,
            progress: fallbackStage.status === "delivered" ? 100 : order.progress,
          };
        }

        return { ...order, stageId: fallbackStage.id };
      }),
    );

    setProductionStages((current) => current.filter((stage) => stage.id !== stageId));
  }

  async function restockLowInventory() {
    const lowItems = inventory.filter((item) => item.quantity < item.minQuantity);

    if (!lowItems.length) {
      createNotification({
        tone: "success",
        title: "Estoque em dia",
        message: "Nenhum item abaixo do mínimo precisa de reposição.",
      });
      setView("inventory");
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        await Promise.all(
          lowItems.map((item) =>
            graphflowApi.createInventoryMovement({
              inventoryId: item.id,
              type: "IN",
              quantity: item.minQuantity + Math.max(item.minQuantity, 10) - item.quantity,
              reason: "Reposicao automatica de itens abaixo do minimo",
            }),
          ),
        );
        await refreshWorkspace();
        createNotification({
          tone: "success",
          title: "Reposicao aplicada",
          message: `${lowItems.length} item(ns) abaixo do minimo foram repostos.`,
        });
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Reposicao nao aplicada",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      setView("inventory");
      return;
    }

    setInventory((current) =>
      current.map((item) =>
        item.quantity < item.minQuantity
          ? {
              ...item,
              quantity: item.minQuantity + Math.max(item.minQuantity, 10),
              lastMove: "agora",
            }
          : item,
      ),
    );
    createNotification({
      tone: "success",
      title: "Reposição aplicada",
      message: `${lowItems.length} item(ns) abaixo do mínimo foram repostos.`,
    });
    setView("inventory");
  }

  function openMachineMaintenance(machineId: string) {
    const machine = machines.find((item) => item.id === machineId);

    if (!machine) {
      return;
    }

    setMaintenanceDraft(defaultMaintenanceDraft(machines, users, machineId));
    setModalMode("maintenance");
  }

  async function createMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedSector = sectors.find((sector) => sector.id === machineDraft.sectorId);

    if (!machineDraft.name.trim() || !selectedSector) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        const savedMachine = await graphflowApi.createMachine(machineDraft, sectors);
        setMachines((current) => [savedMachine, ...current]);
        await refreshWorkspace();
        createNotification({
          tone: "success",
          title: "Maquina cadastrada",
          message: `${savedMachine.name} foi adicionada ao parque produtivo.`,
        });
        setModalMode(null);
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Maquina nao cadastrada",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      setView("machines");
      return;
    }

    const nextMachine: Machine = {
      id: `maq-${Date.now()}`,
      name: machineDraft.name.trim(),
      sector: selectedSector.name,
      status: "Operando",
      utilization: 0,
      nextMaintenance: formatShortDate(machineDraft.nextMaintenanceAt),
      costMonth: machineDraft.costMonth,
    };

    setMachines((current) => [nextMachine, ...current]);
    createNotification({
      tone: "success",
      title: "Maquina cadastrada",
      message: `${nextMachine.name} foi adicionada ao parque produtivo.`,
    });
    setModalMode(null);
    setView("machines");
  }

  async function submitMaintenanceTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const machine = machines.find((item) => item.id === maintenanceDraft.machineId);

    if (!machine || !maintenanceDraft.title.trim() || !maintenanceDraft.description.trim()) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.createMaintenanceTicket({
          machineId: maintenanceDraft.machineId,
          assignedUserId: maintenanceDraft.assignedUserId || undefined,
          priority: maintenanceDraft.priority,
          title: maintenanceDraft.title.trim(),
          description: maintenanceDraft.description.trim(),
          observations: maintenanceDraft.observations.trim() || undefined,
        });
        await refreshWorkspace();
        createNotification({
          tone: "warning",
          title: "Chamado de manutencao",
          message: `${machine.name} teve um chamado de manutencao aberto.`,
        });
        setModalMode(null);
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Chamado nao aberto",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      setView("machines");
      return;
    }

    setMachines((current) =>
      current.map((item) =>
        item.id === maintenanceDraft.machineId
          ? {
              ...item,
              status: "Manutenção",
              utilization: 12,
              nextMaintenance: "Hoje",
            }
          : item,
      ),
    );
    createNotification({
      tone: "warning",
      title: "Chamado de manutenção",
      message: `${machine.name} teve um chamado de manutenção aberto.`,
    });
    setModalMode(null);
    setView("machines");
  }

  async function createSector() {
    if (graphflowApi.enabled()) {
      try {
        const sector = await graphflowApi.createSector(`Novo Setor ${sectors.length + 1}`);
        setSectors((current) => [sector, ...current]);
        setProductionStages(stagesFromSectors([sector, ...sectors]));
        await refreshWorkspace();
        setView("sectors");
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Setor nao salvo",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    const nextOrder = sectors.length;
    setSectors((current) => [
      {
        id: `sec-${Date.now()}`,
        name: `Novo Setor ${current.length + 1}`,
        orders: 0,
        capacity: 0,
        sla: "100%",
        lead: "0h",
        order: nextOrder,
      },
      ...current,
    ]);
    setView("sectors");
  }

  async function updateSector(
    sectorId: string,
    update: Partial<Pick<Sector, "name" | "capacity" | "sla" | "lead">>,
  ) {
    const currentSector = sectors.find((sector) => sector.id === sectorId);
    const nextName = update.name?.trim();

    if (!currentSector || (update.name !== undefined && !nextName)) {
      return;
    }

    const renamed = nextName && nextName !== currentSector.name;
    const finalName = nextName || currentSector.name;

    if (graphflowApi.enabled()) {
      try {
        const savedSector = await graphflowApi.updateSector(sectorId, {
          ...update,
          name: finalName,
        });
        setSectors((current) =>
          current.map((sector) => (sector.id === sectorId ? savedSector : sector)),
        );
        setProductionStages((current) =>
          current.map((stage) =>
            stage.id === sectorId ? { ...stage, name: savedSector.name } : stage,
          ),
        );
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Setor nao atualizado",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setSectors((current) =>
      current.map((sector) =>
        sector.id === sectorId
          ? {
              ...sector,
              ...update,
              name: finalName,
              capacity: Math.max(0, Math.min(100, update.capacity ?? sector.capacity)),
            }
          : sector,
      ),
    );

    if (renamed) {
      setProducts((current) =>
        current.map((product) =>
          product.sector === currentSector.name ? { ...product, sector: finalName } : product,
        ),
      );
      setOrders((current) =>
        current.map((order) =>
          order.sector === currentSector.name ? { ...order, sector: finalName } : order,
        ),
      );
      setMachines((current) =>
        current.map((machine) =>
          machine.sector === currentSector.name ? { ...machine, sector: finalName } : machine,
        ),
      );
    }
  }

  async function deleteSector(sectorId: string) {
    const sectorToRemove = sectors.find((sector) => sector.id === sectorId);
    const fallbackSector = sectors.find((sector) => sector.id !== sectorId);

    if (!sectorToRemove || !fallbackSector || sectors.length <= 1) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.deleteSector(sectorId);
        setSectors((current) => current.filter((sector) => sector.id !== sectorId));
        setProductionStages((current) => current.filter((stage) => stage.id !== sectorId));
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Setor nao removido",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setSectors((current) => current.filter((sector) => sector.id !== sectorId));
    setProducts((current) =>
      current.map((product) =>
        product.sector === sectorToRemove.name
          ? { ...product, sector: fallbackSector.name }
          : product,
      ),
    );
    setOrders((current) =>
      current.map((order) =>
        order.sector === sectorToRemove.name ? { ...order, sector: fallbackSector.name } : order,
      ),
    );
    setMachines((current) =>
      current.map((machine) =>
        machine.sector === sectorToRemove.name ? { ...machine, sector: fallbackSector.name } : machine,
      ),
    );
  }

  async function handleSetSectorOrder(sectorId: string, newPosition: number) {
    const sorted = [...sectors].sort((a, b) => a.order - b.order);
    const targetIndex = sorted.findIndex((s) => s.id === sectorId);
    if (targetIndex === -1) return;
    const clamped = Math.max(0, Math.min(sorted.length - 1, newPosition));
    if (clamped === targetIndex) return;

    const item = sorted[targetIndex];
    sorted.splice(targetIndex, 1);
    sorted.splice(clamped, 0, item);
    const reordered = sorted.map((s, i) => ({ ...s, order: i }));

    if (graphflowApi.enabled()) {
      try {
        await Promise.all(
          reordered.map((s) => graphflowApi.updateSector(s.id, { kanbanOrder: s.order })),
        );
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Ordem nao atualizada",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setSectors(reordered);
    setProductionStages(stagesFromSectors(reordered));
  }

  async function linkProductToSector(productId: string, sectorId: string) {
    const sector = sectors.find((item) => item.id === sectorId);
    const product = products.find((item) => item.id === productId);

    if (!sector || !product) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        const savedProduct = await graphflowApi.updateProduct(
          productId,
          { sector: sector.name },
          sector.id,
        );
        setProducts((current) =>
          current.map((item) => (item.id === productId ? savedProduct : item)),
        );
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Produto nao vinculado",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, sector: sector.name } : product,
      ),
    );
    setOrders((current) =>
      current.map((order) =>
        order.productId === productId ? { ...order, sector: sector.name } : order,
      ),
    );
  }

  function exportPanelReport() {
    const content = [
      "Indicador;Valor",
      `Pedidos;${orders.length}`,
      `Clientes;${clients.length}`,
      `Produtos;${products.length}`,
      `Setores;${sectors.length}`,
      `Receita aberta;${formatCurrency(finance.find((entry) => entry.type === "receivable")?.value ?? 0)}`,
      `Contas a pagar;${formatCurrency(finance.find((entry) => entry.type === "payable")?.value ?? 0)}`,
    ].join("\n");

    downloadReportFile("relatorio-geral-painel.csv", content);
  }

  async function markAllNotificationsRead() {
    if (graphflowApi.enabled()) {
      try {
        await Promise.all(
          notifications
            .filter((notification) => !notification.read)
            .map((notification) => graphflowApi.updateNotification(notification.id, { read: true })),
        );
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Notificacoes nao atualizadas",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      setView("notifications");
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
    setView("notifications");
  }

  async function dismissNotification(notificationId: string) {
    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.updateNotification(notificationId, { read: true });
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Notificacao nao atualizada",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification,
      ),
    );
  }

  async function removeNotification(notificationId: string) {
    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.deleteNotification(notificationId);
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Notificacao nao removida",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId),
    );
  }

  async function clearReadNotificationsWithConfirm() {
    const readNotifications = notifications.filter((notification) => notification.read);

    if (readNotifications.length === 0) {
      createNotification({
        tone: "info",
        title: "Nenhuma exclusao pendente",
        message: "Nao existem avisos lidos para remover.",
      });
      setView("notifications");
      return;
    }

    const confirmed = window.confirm(
      `Remover ${readNotifications.length} aviso(s) ja lido(s)? Esta acao nao remove avisos pendentes.`,
    );

    if (!confirmed) return;

    if (graphflowApi.enabled()) {
      try {
        await Promise.all(readNotifications.map((notification) => graphflowApi.deleteNotification(notification.id)));
        await refreshWorkspace();
        createNotification({
          tone: "success",
          title: "Avisos removidos",
          message: `${readNotifications.length} aviso(s) lido(s) foram removidos com seguranca.`,
        });
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Exclusao nao concluida",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      setView("notifications");
      return;
    }

    setNotifications((current) => current.filter((notification) => !notification.read));
    createNotification({
      tone: "success",
      title: "Avisos removidos",
      message: `${readNotifications.length} aviso(s) lido(s) foram removidos.`,
    });
    setView("notifications");
  }

  async function restockItem(itemId: string, quantity: number) {
    const item = inventory.find((entry) => entry.id === itemId);

    if (!item || quantity <= 0) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.createInventoryMovement({
          inventoryId: itemId,
          type: "IN",
          quantity,
          reason: "Reposicao manual pelo painel",
        });
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Estoque nao atualizado",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setInventory((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: item.quantity + quantity,
              lastMove: "agora",
            }
          : item,
      ),
    );
  }

  async function updateInventoryItem(itemId: string, update: InventoryDraft) {
    const nextName = update.name.trim();
    const nextCategory = update.category.trim();
    const nextUnit = update.unit.trim();

    if (!nextName || !nextCategory || !nextUnit) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        const savedItem = await graphflowApi.updateInventoryItem(itemId, {
          name: nextName,
          category: nextCategory,
          imageUrl: update.imageUrl?.trim(),
          quantity: Math.max(0, update.quantity),
          minQuantity: Math.max(0, update.minQuantity),
          unit: nextUnit,
          lastMove: update.lastMove.trim() || "agora",
        });
        setInventory((current) => current.map((item) => (item.id === itemId ? savedItem : item)));
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Estoque nao atualizado",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setInventory((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              name: nextName,
              category: nextCategory,
              imageUrl: update.imageUrl?.trim(),
              quantity: Math.max(0, update.quantity),
              minQuantity: Math.max(0, update.minQuantity),
              unit: nextUnit,
              lastMove: update.lastMove.trim() || "agora",
            }
          : item,
      ),
    );
  }

  async function deleteInventoryItem(itemId: string) {
    const item = inventory.find((entry) => entry.id === itemId);
    if (!item) return;

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.deleteInventoryItem(itemId);
        setInventory((current) => current.filter((entry) => entry.id !== itemId));
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Estoque nao removido",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setInventory((current) => current.filter((entry) => entry.id !== itemId));
  }

  function updateOrder(orderId: string, update: OrderEditDraft) {
    const product = products.find((item) => item.id === update.productId);
    const machine = machines.find((item) => item.id === update.machineId);

    if (!product || !update.customer.trim()) {
      return;
    }

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? {
              ...order,
              customer: update.customer.trim(),
              product: product.name,
              productId: product.id,
              sector: update.sector.trim() || product.sector,
              machineId: machine?.id,
              responsible: update.responsible.trim() || order.responsible,
              quantity: Math.max(0, update.quantity),
              total: calculateOrderTotal(product, update.quantity),
              status: update.status,
              progress: Math.max(0, Math.min(100, update.progress)),
              delivery: update.delivery.trim() || order.delivery,
              priority: update.priority,
            }
          : order,
      ),
    );
  }

  async function saveOrderDetail(orderId: string, update: OrderEditDraft & { clientEmail?: string; clientPhone?: string; clientDocument?: string }) {
    updateOrder(orderId, update);

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.updateOrder(orderId, {
          status: update.status,
          deliveryDate: update.delivery,
          clientSnapshot: {
            name: update.customer,
            email: update.clientEmail ?? "",
            phone: update.clientPhone ?? "",
            document: update.clientDocument ?? "",
            responsible: update.responsible,
          },
        });
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Pedido nao atualizado",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
    }
  }

  async function addOrderArtFile(order: Order, input: { productName: string; name: string; url: string }) {
    if (!input.name.trim()) return;

    if (graphflowApi.enabled()) {
      try {
        const savedFile = await graphflowApi.createFile({
          name: input.name.trim(),
          type: "Arte",
          linkedTo: `${order.number ?? order.id} · ${input.productName}`,
          url: input.url.trim(),
          owner: order.responsible ?? "",
          notes: `Arte do pedido ${order.number ?? order.id}`,
          size: "arquivo externo",
        });
        setFiles((current) => [savedFile, ...current]);
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Arte nao anexada",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    const artFile: OrderArtFile = {
      id: `art-${Date.now()}`,
      productName: input.productName,
      name: input.name.trim(),
      url: input.url.trim() || "#",
      size: "arquivo externo",
    };
    setOrders((current) =>
      current.map((item) =>
        item.id === order.id ? { ...item, artFiles: [...(item.artFiles ?? []), artFile] } : item,
      ),
    );
  }

  async function createQuoteFromDraft(status: QuoteStatus = "Enviado") {
    const client = clients.find((item) => item.id === quoteDraft.customerId) ?? clients[0];
    const items = quoteDraft.items.filter((item) => item.quantity > 0 && item.unitPrice >= 0);
    const quoteSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const quoteDiscount =
      quoteDraft.discountType === "percent"
        ? quoteSubtotal * (Math.min(quoteDraft.discount, 100) / 100)
        : quoteDraft.discount;
    const quoteTax = Math.max(0, quoteSubtotal - quoteDiscount) * 0.05;
    const itemsWithDescriptions = items.map((item) => ({
      ...item,
      notes: quoteItemDescription(item.productName).join(", "),
    }));

    if (!client) {
      createNotification({
        tone: "warning",
        title: "Cliente obrigatorio",
        message: "Selecione ou cadastre um cliente antes de gerar o orcamento.",
      });
      return;
    }

    if (!items.length) {
      createNotification({
        tone: "warning",
        title: "Itens obrigatorios",
        message: "Adicione pelo menos um item ao orcamento para gerar o link publico.",
      });
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        const savedQuote = await graphflowApi.createQuote(
          {
            customerId: client.id,
            validUntil: quoteDraft.validUntil,
            notes: quoteDraft.notes.trim(),
            internalNotes: quoteDraft.internalNotes.trim(),
            discountAmount: Number(quoteDiscount.toFixed(2)),
            taxAmount: Number(quoteTax.toFixed(2)),
            metadata: {
              issueDate: quoteDraft.issueDate,
              paymentCondition: quoteDraft.paymentCondition,
              productionDeadline: quoteDraft.productionDeadline,
              contactName: quoteDraft.contactName.trim(),
              customerEmail: quoteDraft.customerEmail.trim(),
              customerPhone: quoteDraft.customerPhone.trim(),
              responsible: quoteDraft.responsible.trim(),
              discountType: quoteDraft.discountType,
              discountValue: quoteDraft.discount,
              customerSnapshot: {
                id: client.id,
                name: client.name,
                company: client.company,
                email: quoteDraft.customerEmail.trim() || client.email,
                phone: quoteDraft.customerPhone.trim() || client.phone,
                document: client.document,
                address: client.address,
              },
            },
            items: itemsWithDescriptions,
            sendNow: status !== "Rascunho",
          },
          clients,
          products,
        );
        rememberQuotePublicLink(savedQuote);
        setQuotes((current) => mergeQuotePublicLinks([savedQuote, ...current]));
        await refreshWorkspace();
        setQuotes((current) =>
          mergeQuotePublicLinks(
            current.some((quote) => quote.id === savedQuote.id) ? current : [savedQuote, ...current],
          ),
        );
        createNotification({
          tone: "success",
          title: "Orcamento gerado",
          message: `${savedQuote.id} para ${savedQuote.customerName} esta pronto para envio.`,
        });
        if (status !== "Rascunho") {
          window.localStorage.removeItem(QUOTE_DRAFT_STORAGE_KEY);
        }
        setQuoteDraft(defaultQuoteDraft(clients));
        setView("quotes");
        setModalMode(null);
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Orcamento nao salvo",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    const id = createLocalDocumentNumber("ORC", quotes.map((quote) => quote.id));
    const nextQuote: Quote = {
      id,
      customerId: client.id,
      customerName: client.name,
      customerEmail: quoteDraft.customerEmail.trim() || client.email,
      responsible: quoteDraft.responsible.trim() || "Equipe comercial",
      validUntil: quoteDraft.validUntil,
      notes: quoteDraft.notes.trim(),
      status,
      publicToken: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: "Hoje",
      items: items.map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice,
      })),
    };

    rememberQuotePublicLink(nextQuote);
    setQuotes((current) => mergeQuotePublicLinks([nextQuote, ...current]));
    createNotification({
      tone: "success",
      title: "Orçamento gerado",
      message: `${nextQuote.id} para ${nextQuote.customerName} está pronto para envio.`,
    });
    if (status !== "Rascunho") {
      window.localStorage.removeItem(QUOTE_DRAFT_STORAGE_KEY);
    }
    setQuoteDraft(defaultQuoteDraft(clients));
    setView("quotes");
    setModalMode(null);
  }

  async function updateMachine(
    machineId: string,
    update: Partial<Pick<Machine, "name" | "sector" | "status" | "utilization" | "nextMaintenance" | "costMonth">>,
  ) {
    const nextName = update.name?.trim();
    const nextSector = update.sector?.trim();
    const nextMaintenance = update.nextMaintenance?.trim();

    if (
      (update.name !== undefined && !nextName) ||
      (update.sector !== undefined && !nextSector) ||
      (update.nextMaintenance !== undefined && !nextMaintenance)
    ) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        const targetSector = sectors.find((sector) => sector.name === (nextSector ?? machines.find((machine) => machine.id === machineId)?.sector));
        const savedMachine = await graphflowApi.updateMachine(
          machineId,
          {
            name: nextName,
            sectorId: targetSector?.id,
            status: update.status,
            nextMaintenance: nextMaintenance,
            costMonth: update.costMonth,
          },
          sectors,
        );
        setMachines((current) =>
          current.map((machine) => (machine.id === machineId ? savedMachine : machine)),
        );
        await refreshWorkspace();
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Maquina nao atualizada",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setMachines((current) =>
      current.map((machine) =>
        machine.id === machineId
          ? {
              ...machine,
              ...update,
              name: nextName ?? machine.name,
              sector: nextSector ?? machine.sector,
              utilization: Math.max(0, Math.min(100, update.utilization ?? machine.utilization)),
              nextMaintenance: nextMaintenance ?? machine.nextMaintenance,
              costMonth: Math.max(0, update.costMonth ?? machine.costMonth),
            }
          : machine,
      ),
    );
  }

  async function deleteMachine(machineId: string) {
    const machineToRemove = machines.find((machine) => machine.id === machineId);

    if (!machineToRemove || machines.length <= 1) {
      return;
    }

    if (graphflowApi.enabled()) {
      try {
        await graphflowApi.deleteMachine(machineId);
        setMachines((current) => current.filter((machine) => machine.id !== machineId));
        await refreshWorkspace();
        createNotification({
          tone: "info",
          title: "Maquina removida",
          message: `${machineToRemove.name} foi retirada do painel de maquinario.`,
        });
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Maquina nao removida",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setMachines((current) => current.filter((machine) => machine.id !== machineId));
    createNotification({
      tone: "info",
      title: "Máquina removida",
      message: `${machineToRemove.name} foi retirada do painel de maquinário.`,
    });
  }

  function refreshData() {
    refreshWorkspace();
  }

  function getHeaderAction(): HeaderAction | null {
    switch (view) {
      case "dashboard":
        return { label: "Novo Pedido", icon: ClipboardList, onClick: () => openModal("order") };
      case "orders":
        return { label: "Novo Pedido", icon: Plus, onClick: () => openModal("order") };
      case "production":
        return {
          label: "Novo Estágio",
          icon: Layers3,
          onClick: () => setProductionStageFocusSignal((current) => current + 1),
        };
      case "clients":
        return { label: "Novo Cliente", icon: UserPlus, onClick: () => openModal("client") };
      case "users":
        return { label: "Novo contato", icon: UserPlus, onClick: () => openModal("user") };
      case "support":
        return {
          label: "Abrir WhatsApp",
          icon: MessageCircle,
          onClick: () => {
            window.open("https://wa.me/", "_blank", "noopener,noreferrer");
          },
        };
      case "products":
      case "catalog":
        return { label: "Novo Produto", icon: Package, onClick: () => openModal("product") };
      case "inventory":
        return { label: "Repor Baixos", icon: Boxes, onClick: restockLowInventory };
      case "machines":
        return { label: "Nova Máquina", icon: Cpu, onClick: () => openModal("machine") };
      case "sectors":
        return { label: "Novo Setor", icon: Layers3, onClick: createSector };
      case "quotes":
        return {
          label: "Novo Orçamento",
          icon: FileText,
          onClick: () => openModal("quote"),
        };
      case "finance":
        return { label: "Nova Despesa", icon: CreditCard, onClick: () => openModal("expense") };
      case "reports":
        return { label: "Exportar", icon: Download, onClick: exportPanelReport };
      case "files":
        return { label: "Upload", icon: Upload, onClick: () => openModal("file") };
      case "notifications":
        return { label: "Marcar Lidas", icon: BellRing, onClick: markAllNotificationsRead };
      case "settings":
        return { label: "Atualizar Dados", icon: RefreshCw, onClick: refreshData };
      default:
        return null;
    }
  }

  const currentHeaderAction = authenticated ? getHeaderAction() : null;
  const HeaderActionIcon = currentHeaderAction?.icon;
  const PageHeaderIcon = view === "orders" ? ClipboardList : view === "catalog" ? Package : view === "users" ? Users : null;
  const headerDateFilterOptions = dateFilterOptions();
  const selectedDateFilterLabel =
    headerDateFilterOptions.find((option) => option.value === dateFilter)?.label ??
    headerDateFilterOptions[0].label;
  const selectedOrder = selectedOrderId
    ? orders.find((order) => order.id === selectedOrderId)
    : undefined;
  const selectedQuote = selectedQuoteId
    ? quotes.find((quote) => quote.id === selectedQuoteId || quote.publicQuoteId === selectedQuoteId)
    : undefined;
  const loggedUser = useMemo(
    () =>
      users.find(
        (user) =>
          user.id === authUserId ||
          user.email === authUserId ||
          user.id === authSessionUser?.id ||
          user.email === authSessionUser?.email,
      ),
    [authSessionUser?.email, authSessionUser?.id, authUserId, users],
  );
  const sidebarUser = useMemo(
    () => sidebarUserProfile(loggedUser, authSessionUser),
    [authSessionUser, loggedUser],
  );

  if (authChecking) {
    return <ToastProvider><AuthLoadingScreen /></ToastProvider>;
  }

  if (!authenticated) {
    return (
      <ToastProvider>
        <LoginScreen
          onSubmit={async () => {
            const session = graphflowApi.enabled()
              ? await graphflowApi.session().catch(() => null)
              : null;
            setAuthUserId(session?.user.id ?? null);
            setAuthSessionUser(
              session
                ? {
                    id: session.user.id,
                    tenantId: session.user.tenantId,
                    email: session.user.email,
                    role: session.user.role,
                  }
                : null,
            );
            setAuthenticated(true);
            await refreshWorkspace();
            setView("dashboard");
          }}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
    <div className={`app-shell theme-${view}`} style={appThemeStyle}>
      <Sidebar
        view={view}
        onViewChange={(nextView) => {
          setView(nextView);
          setSidebarOpen(false);
        }}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        unreadCount={unreadCount}
        user={sidebarUser}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
      />

      <main className="workspace">
        <Topbar
          view={view}
          query={query}
          onQueryChange={setQuery}
          dark={dark}
          unreadCount={unreadCount}
          onViewChange={setView}
          onToggleTheme={() => setDark((current) => !current)}
          onOpenSidebar={() => setSidebarOpen(true)}
          onCreateOrder={() => openModal("order")}
          onNotifications={() => setView("notifications")}
          onLogout={async () => {
            try {
              await graphflowApi.logout();
            } catch {
              // continua para limpar estado local mesmo se a API falhar
            }
            setAuthUserId(null);
            setAuthSessionUser(null);
            setAuthenticated(false);
          }}
        />

        <div className="page-frame">
          {dataLoading ? <div className="data-loading">Atualizando dados do banco...</div> : null}
          {view !== "quotes" && view !== "support" && view !== "settings" && view !== "finance" ? (
          <header className="page-header">
            <div className={PageHeaderIcon ? "page-title-with-icon" : undefined}>
              {PageHeaderIcon ? (
                <span className="page-title-icon">
                  <PageHeaderIcon size={30} />
                </span>
              ) : null}
              <div>
                <h1>{currentCopy.title}</h1>
                <p>{currentCopy.eyebrow}</p>
              </div>
            </div>
            <div className="header-actions">
              {dateAwareViews.has(view) ? (
                <label className="date-button date-filter-control">
                  <span className="date-filter-icon" aria-hidden="true">
                    <CalendarDays size={17} />
                  </span>
                  <span className="sr-only">Filtrar período</span>
                  <span className="date-filter-copy">
                    <small>Período</small>
                    <strong>{selectedDateFilterLabel}</strong>
                  </span>
                  <select
                    aria-label="Filtrar período"
                    value={dateFilter}
                    onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                  >
                    {headerDateFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="date-filter-chevron" size={16} />
                </label>
              ) : null}
              {currentHeaderAction && HeaderActionIcon ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={currentHeaderAction.onClick}
                >
                  <HeaderActionIcon size={18} />
                  {currentHeaderAction.label}
                </button>
              ) : null}
            </div>
          </header>
          ) : null}

          {view === "dashboard" ? (
            <DashboardView
              overview={dateFilter === "all" ? dashboardOverview : null}
              orders={filteredOrders}
              finance={finance}
              inventory={inventory}
              notifications={notifications}
              sectors={sectors}
              onOpenModal={openModal}
              onViewChange={setView}
              onRefreshData={refreshData}
              onClearReadNotifications={clearReadNotificationsWithConfirm}
            />
          ) : null}

          {view === "orders" ? (
            <OrdersView
              orders={filteredOrders}
              onCreateOrder={() => openModal("order")}
              onOpenOrder={openOrderDetail}
              onUpdateStatus={updateOrderStatus}
            />
          ) : null}

          {view === "production" ? (
            <ProductionView
              orders={orders}
              stages={productionStages}
              focusCreateSignal={productionStageFocusSignal}
              onCreateStage={createProductionStage}
              onRenameStage={renameProductionStage}
              onRemoveStage={removeProductionStage}
              onMoveOrder={moveOrderToProductionStage}
              onOpenOrder={openOrderDetail}
            />
          ) : null}

          {view === "clients" ? (
            <ClientsView clients={filteredClients} onCreateClient={() => openModal("client")} />
          ) : null}

          {view === "users" ? (
            <UsersView
              users={users}
              sectors={sectors}
              onUploadFile={uploadFile}
              onCreateUser={() => openModal("user")}
              onUpdateUser={async (id, update) => {
                try {
                  const nextUser = await graphflowApi.updateUser(id, update);
                  setUsers((current) => current.map((user) => (user.id === id ? nextUser : user)));
                  await refreshWorkspace();
                } catch (error) {
                  createNotification({
                    tone: "danger",
                    title: "Usuario nao atualizado",
                    message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
                  });
                }
              }}
              onUpdatePassword={async (id, password) => {
                try {
                  await graphflowApi.updateUserPassword(id, password);
                  await refreshWorkspace();
                  createNotification({
                    tone: "success",
                    title: "Senha atualizada",
                    message: "A senha temporaria foi enviada para o provedor de autenticacao.",
                  });
                } catch (error) {
                  createNotification({
                    tone: "danger",
                    title: "Senha nao atualizada",
                    message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
                  });
                }
              }}
              onDeleteUser={deleteUser}
            />
          ) : null}

          {view === "support" ? (
            <SupportView
              clients={clients}
              orders={orders}
              products={products}
              onCreateOrder={() => openModal("order")}
              onCreateQuote={() => {
                openModal("quote");
              }}
              onViewChange={setView}
            />
          ) : null}

          {view === "products" ? (
            <ProductsView
              products={filteredProducts}
              onCreateProduct={() => openModal("product")}
              onEditProduct={openProductEdit}
              onDeleteProduct={deleteProduct}
            />
          ) : null}

          {view === "catalog" ? (
            <CatalogView
              products={filteredProducts}
              onManageCategories={() => setView("products")}
              onSelectProduct={(productId) => {
                const product = products.find((currentProduct) => currentProduct.id === productId);
                const quantity = product?.minOrderQty ?? 50;
                setOrderDraft({
                  ...defaultOrderDraft(products, clients),
                  productId,
                  quantity,
                  items: product
                    ? [
                        {
                          id: createClientId("order-item"),
                          productId: product.id,
                          quantity,
                          note: "",
                          artFileName: "",
                          artFileUrl: "",
                        },
                      ]
                    : [],
                  fractions: product?.allowsFractions
                    ? [
                        {
                          id: "fraction-1",
                          quantity,
                          color: firstProductColor(product),
                          note: "Variação principal",
                        },
                      ]
                    : [],
                });
                setModalMode("order");
              }}
            />
          ) : null}

          {view === "inventory" ? (
            <InventoryView
              inventory={inventory}
              onUploadFile={uploadFile}
              onRestock={restockItem}
              onUpdateItem={updateInventoryItem}
              onDeleteItem={deleteInventoryItem}
            />
          ) : null}

          {view === "machines" ? (
            <MachinesView
              machines={machines}
              orders={orders}
              sectors={sectors}
              onOpenMaintenance={openMachineMaintenance}
              onUpdateMachine={updateMachine}
              onDeleteMachine={deleteMachine}
            />
          ) : null}

          {view === "sectors" ? (
            <SectorsView
              sectors={sectors}
              orders={orders}
              machines={machines}
              users={users}
              canManageUsers={
                !loggedUser ||
                loggedUser?.permissions.includes("*") === true ||
                loggedUser?.permissions.includes("users:write") === true ||
                loggedUser?.role === "ADMIN"
              }
              onViewChange={setView}
              onUpdateSector={updateSector}
              onDeleteSector={deleteSector}
              onAddUserToSector={async (userId, sectorId) => {
                const user = users.find((u) => u.id === userId);
                if (!user) return;
                const nextSectorIds = [...new Set([...user.sectorIds, sectorId])];
                try {
                  const updated = await graphflowApi.updateUser(userId, { sectorIds: nextSectorIds });
                  setUsers((current) => current.map((u) => (u.id === userId ? updated : u)));
                } catch (error) {
                  createNotification({
                    title: "Erro ao vincular usuário",
                    message: error instanceof Error ? error.message : "Tente novamente.",
                    tone: "error",
                  });
                }
              }}
              onRemoveUserFromSector={async (userId, sectorId) => {
                const user = users.find((u) => u.id === userId);
                if (!user) return;
                const nextSectorIds = user.sectorIds.filter((id) => id !== sectorId);
                try {
                  const updated = await graphflowApi.updateUser(userId, { sectorIds: nextSectorIds });
                  setUsers((current) => current.map((u) => (u.id === userId ? updated : u)));
                } catch (error) {
                  createNotification({
                    title: "Erro ao remover vínculo",
                    message: error instanceof Error ? error.message : "Tente novamente.",
                    tone: "error",
                  });
                }
              }}
              onSetSectorOrder={handleSetSectorOrder}
            />
          ) : null}

          {view === "quotes" ? (
            <QuotesView
              quotes={quotes}
              onCreateQuote={() => openModal("quote")}
              onOpenQuote={openQuoteDetail}
            />
          ) : null}

          {view === "finance" ? (
            <FinanceView
              finance={finance}
              onCreateExpense={() => openModal("expense")}
              onScheduleCharge={scheduleCharge}
              onSendReminder={sendPaymentReminder}
            />
          ) : null}

          {view === "reports" ? (
            <ReportsView
              orders={filteredOrders}
              finance={finance}
              sectors={sectors}
              report={dateFilter === "all" ? managementReport : null}
            />
          ) : null}

          {view === "files" ? (
            <FilesView
              files={files}
              onUploadFile={uploadFile}
              onCreateFile={() => openModal("file")}
              onUpdateFile={updateFile}
              onDeleteFile={deleteFile}
            />
          ) : null}

          {view === "notifications" ? (
            <NotificationsView
              notifications={notifications}
              onRead={dismissNotification}
              onRemove={removeNotification}
            />
          ) : null}

          {view === "landing" ? (
            <LandingView />
          ) : null}

          {view === "settings" ? (
            <SettingsView dark={dark} onToggleTheme={() => setDark((current) => !current)} onRefreshData={refreshData} />
          ) : null}
        </div>
      </main>

      <Modal mode={modalMode} onClose={closeModal}>
        {modalMode === "order-detail" && selectedOrder ? (
          <OrderDetail
            order={selectedOrder}
            clients={clients}
            finance={finance}
            files={files}
            products={products}
            machines={machines}
            sectors={sectors}
            users={users}
            onUploadFile={uploadFile}
            onSave={saveOrderDetail}
            onAddArtFile={addOrderArtFile}
            onAddPayment={async (amount, method) => {
              if (graphflowApi.enabled()) {
                const savedEntry = await graphflowApi.createFinanceEntry({
                  label: `Pagamento - Pedido ${selectedOrder.number ?? selectedOrder.id}`,
                  type: "Entrada",
                  value: amount,
                  due: new Date().toISOString().split("T")[0],
                  status: "Recebido",
                  category: "Vendas",
                  referenceType: "order",
                  referenceId: selectedOrder.id,
                  paymentMethod: method,
                  notes: "",
                  attachmentUrl: "",
                });
                setFinance([...finance, savedEntry]);
              }
            }}
          />
        ) : null}

        {modalMode === "order" ? (
          <OrderForm
            clients={clients}
            products={products}
            draft={orderDraft}
            onDraftChange={setOrderDraft}
            orderTotal={orderTotal}
            fractionTotal={fractionTotal}
            validation={orderValidation}
            onUploadFile={uploadFile}
            onSubmit={createOrder}
          />
        ) : null}

        {modalMode === "client" ? (
          <ClientForm
            draft={clientDraft}
            onUploadFile={uploadFile}
            onDraftChange={setClientDraft}
            onSubmit={createClient}
          />
        ) : null}

        {modalMode === "user" ? (
          <UserForm
            draft={userDraft}
            sectors={sectors}
            onUploadFile={uploadFile}
            onDraftChange={setUserDraft}
            onSubmit={createUser}
          />
        ) : null}

        {modalMode === "product" || modalMode === "product-edit" ? (
          <ProductForm
            draft={productDraft}
            inventory={inventory}
            sectors={sectors}
            machines={machines}
            title={modalMode === "product-edit" ? "Editar Produto" : "Novo Produto"}
            subtitle={
              modalMode === "product-edit"
                ? "Atualize cadastro, imagem e regras comerciais."
                : "Regras de venda e produção."
            }
            submitLabel={modalMode === "product-edit" ? "Salvar Alterações" : "Salvar Produto"}
            onUploadFile={uploadFile}
            onDraftChange={setProductDraft}
            onSubmit={modalMode === "product-edit" ? saveProductEdit : createProduct}
          />
        ) : null}

        {modalMode === "machine" ? (
          <MachineForm
            draft={machineDraft}
            sectors={sectors}
            onDraftChange={setMachineDraft}
            onSubmit={createMachine}
          />
        ) : null}

        {modalMode === "maintenance" ? (
          <MaintenanceForm
            draft={maintenanceDraft}
            machines={machines}
            users={users}
            onDraftChange={setMaintenanceDraft}
            onSubmit={submitMaintenanceTicket}
          />
        ) : null}

        {modalMode === "expense" ? (
          <ExpenseForm
            draft={expenseDraft}
            onDraftChange={setExpenseDraft}
            onSubmit={createExpense}
          />
        ) : null}

        {modalMode === "quote-detail" && selectedQuote ? (
          <QuoteDetail
            quote={selectedQuote}
            clients={clients}
            finance={finance}
            onConvert={() => convertQuoteToOrder(selectedQuote)}
          />
        ) : null}

        {modalMode === "quote" ? (
          <QuoteEditor
            draft={quoteDraft}
            quotes={quotes}
            clients={clients}
            products={products}
            onDraftChange={setQuoteDraft}
            onAddClient={() => openModal("client")}
            onSaveDraft={() => createQuoteFromDraft("Rascunho")}
            onGenerate={() => createQuoteFromDraft("Enviado")}
          />
        ) : null}

        {modalMode === "file" ? (
          <FileForm draft={fileDraft} onUploadFile={uploadFile} onDraftChange={setFileDraft} onSubmit={createFile} />
        ) : null}
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
    </ToastProvider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || toasts.length === 0) return null;

  const content = (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`} role="alert">
          <div className="toast-body">
            <span className="toast-title">{toast.title}</span>
            {toast.message && <span className="toast-message">{toast.message}</span>}
            {toast.fields?.length ? (
              <div className="toast-fields" aria-label="Campos destacados">
                {toast.fields.map((field) => (
                  <span key={`${toast.id}-${field}`} className="toast-field">
                    {formatNotificationField(field)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button className="toast-close" type="button" aria-label="Fechar" onClick={() => onDismiss(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}

function AuthLoadingScreen() {
  return (
    <main className="login-screen auth-validation-screen">
      <section className="auth-validation-card" aria-label="Validando sessão segura">
        <div className="auth-validation-content">
          <aside className="auth-validation-brand" aria-label="GraphFlow">
            <Image
              src={GRAPHFLOW_LOGO_SRC}
              alt="GraficFlow"
              width={360}
              height={118}
              className="auth-validation-logo"
              priority
            />
          </aside>

          <div className="auth-validation-divider" aria-hidden="true" />

          <section className="auth-validation-panel">
            <div className="auth-secure-orbit" aria-hidden="true">
              <span className="auth-orbit-dot auth-orbit-dot-green" />
              <span className="auth-orbit-dot auth-orbit-dot-blue-left" />
              <span className="auth-orbit-dot auth-orbit-dot-blue-right" />
              <span className="auth-secure-ring">
                <ShieldCheck size={44} strokeWidth={2.1} />
              </span>
            </div>

            <div className="auth-validation-copy">
              <h1>Validando sessão segura</h1>
              <p>Estamos verificando sua sessão. Isso pode levar alguns segundos.</p>
            </div>

            <div className="auth-session-steps" aria-label="Etapas de validação">
              <div className="auth-session-step is-done">
                <span>
                  <Check size={18} />
                </span>
                <strong>Verificando credenciais</strong>
              </div>
              <i className="auth-step-line is-complete" aria-hidden="true" />
              <div className="auth-session-step is-active">
                <span>
                  <b aria-hidden="true" />
                </span>
                <strong>Validando sessão</strong>
              </div>
              <i className="auth-step-line" aria-hidden="true" />
              <div className="auth-session-step">
                <span>
                  <LockKeyhole size={17} />
                </span>
                <strong>Finalizando</strong>
              </div>
            </div>

            <div className="auth-security-note">
              <ShieldCheck size={30} />
              <div>
                <strong>Sua segurança é nossa prioridade.</strong>
                <span>Não feche esta janela.</span>
              </div>
            </div>
          </section>
        </div>

        <footer className="auth-validation-footer">
          <LockKeyhole size={16} />
          <span>Conexão segura e criptografada</span>
        </footer>
      </section>
    </main>
  );
}

function LoginScreen({ onSubmit }: { onSubmit: () => void | Promise<void> }) {
  return <AuthPage onSubmit={onSubmit} />;
}

function Sidebar({
  view,
  open,
  collapsed,
  unreadCount,
  user,
  onViewChange,
  onClose,
  onToggleCollapsed,
}: {
  view: ViewKey;
  open: boolean;
  collapsed: boolean;
  unreadCount: number;
  user: SidebarUserProfile;
  onViewChange: (view: ViewKey) => void;
  onClose: () => void;
  onToggleCollapsed: () => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(navSections.map((section) => [section.id, true])),
  );

  function toggleSection(sectionId: string) {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  function handleSidebarToggle() {
    if (window.matchMedia("(max-width: 920px)").matches) {
      onClose();
      return;
    }

    onToggleCollapsed();
  }

  return (
    <>
      <aside className={`sidebar ${open ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
        <div className="sidebar-top">
          <BrandBlock compact />
          <button
            className="icon-button sidebar-collapse-button"
            type="button"
            onClick={handleSidebarToggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-pressed={collapsed}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          {navSections.map((section) => {
            const sectionItems = section.items
              .map((id) => navItems.find((item) => item.id === id))
              .filter(Boolean) as typeof navItems;
            const isExpanded = expandedSections[section.id];
            const hasActiveItem = section.items.includes(view);
            const sectionTheme = viewThemes[hasActiveItem ? view : section.items[0]];

            return (
              <section
                className={`nav-section section-${section.id} ${hasActiveItem ? "has-active" : ""}`}
                key={section.id}
                style={
                  {
                    "--section-color": sectionTheme.primary,
                    "--section-color-2": sectionTheme.secondary,
                  } as CSSProperties
                }
              >
                <button
                  className="nav-section-toggle"
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleSection(section.id)}
                >
                  <span>{section.label}</span>
                  <ChevronDown size={15} />
                </button>

                <div className="nav-section-items" hidden={!isExpanded && !collapsed}>
                  {sectionItems.map((item) => {
                    const Icon = iconByView[item.id];
                    const badge = item.id === "notifications" ? unreadCount : item.badge;
                    const itemTheme = viewThemes[item.id];

                    return (
                      <button
                        className={`nav-item ${item.id === "support" ? "support-nav" : ""} ${view === item.id ? "active" : ""}`}
                        type="button"
                        key={item.id}
                        style={
                          {
                            "--item-tone": itemTheme.primary,
                            "--item-tone-2": itemTheme.secondary,
                          } as CSSProperties
                        }
                        onClick={() => onViewChange(item.id)}
                        aria-label={item.label}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon size={19} />
                        <span>{item.label}</span>
                        {badge ? <strong>{badge}</strong> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="user-card" title={user.email ? `${user.name} - ${user.email}` : user.name}>
          <div className="avatar">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                fill
                sizes="46px"
                unoptimized
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}
            <span>{user.initials}</span>
            <i />
          </div>
          <div>
            <strong>{user.name}</strong>
            <span>{user.subtitle}</span>
          </div>
          <ChevronDown size={16} />
        </div>
      </aside>
      {open ? <button className="scrim" type="button" aria-label="Fechar menu" onClick={onClose} /> : null}
    </>
  );
}

function Topbar({
  view,
  query,
  dark,
  unreadCount,
  onQueryChange,
  onViewChange,
  onOpenSidebar,
  onCreateOrder,
  onNotifications,
  onToggleTheme,
  onLogout,
}: {
  view: ViewKey;
  query: string;
  dark: boolean;
  unreadCount: number;
  onQueryChange: (value: string) => void;
  onViewChange: (view: ViewKey) => void;
  onOpenSidebar: () => void;
  onCreateOrder: () => void;
  onNotifications: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="topbar">
      <button
        className="icon-button mobile-menu"
        type="button"
        onClick={onOpenSidebar}
        aria-label="Abrir menu"
        title="Abrir menu"
      >
        <Menu size={20} />
      </button>

      <label className="search-box">
        <span className="sr-only">Buscar</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar pedidos, clientes, produtos..."
          type="search"
        />
        <Search size={20} />
      </label>

      <nav className="topbar-overview" aria-label="Visão geral">
        {topbarOverviewItems.map((itemId) => {
          const Icon = iconByView[itemId];
          const item = navItems.find((navItem) => navItem.id === itemId);
          const badge = itemId === "notifications" ? unreadCount : undefined;
          const itemTheme = viewThemes[itemId];

          return (
            <button
              className={`topbar-overview-item ${itemId === "support" ? "support-topbar" : ""} ${view === itemId ? "active" : ""}`}
              type="button"
              key={itemId}
              style={
                {
                  "--item-tone": itemTheme.primary,
                  "--item-tone-2": itemTheme.secondary,
                  ...(itemId === "support" ? { background: itemTheme.primary, borderColor: itemTheme.primary, color: "#ffffff" } : {}),
                } as CSSProperties
              }
              onClick={() => onViewChange(itemId)}
              aria-current={view === itemId ? "page" : undefined}
              aria-label={item?.label}
              title={item?.label}
            >
              <Icon size={16} />
              {itemId !== "notifications" ? <span>{item?.label}</span> : null}
              {badge ? <strong>{badge}</strong> : null}
            </button>
          );
        })}
      </nav>

      <div className="topbar-actions">
        <button
          className="action-button purple"
          type="button"
          onClick={onCreateOrder}
          aria-label="Novo pedido"
          title="Novo pedido"
        >
          <Plus size={22} />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="WhatsApp"
          title="WhatsApp"
          onClick={() => window.open("https://wa.me/", "_blank", "noopener,noreferrer")}
        >
          <MessageCircle size={20} />
        </button>
        <button
          className="icon-button has-badge"
          type="button"
          onClick={onNotifications}
          aria-label="Notificações"
          title="Notificações"
        >
          <Bell size={20} />
          {unreadCount ? <span>{unreadCount}</span> : null}
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onToggleTheme}
          aria-label="Alternar tema"
          title="Alternar tema"
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onLogout}
          aria-label="Sair"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}

function chartSeries(values: number[], fallback: number[] = [0, 0]) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length >= 2) return clean.slice(-18);
  if (clean.length === 1) return [0, clean[0]];
  return fallback;
}

function cumulativeSeriesFrom(values: number[]) {
  let total = 0;
  return chartSeries(values.map((value) => {
    total += Math.max(0, value);
    return total;
  }));
}

function orderStatusCounts(orders: Order[]) {
  return (Object.keys(statusMeta) as OrderStatus[]).map((status) => ({
    status,
    label: statusMeta[status].label,
    count: orders.filter((order) => order.status === status).length,
  }));
}

function isDeliveredOrderStatus(status: OrderStatus) {
  return status === "delivered";
}

function isCanceledOrderStatus(status: OrderStatus) {
  return status === "canceled";
}

function isClosedOrderStatus(status: OrderStatus) {
  return isDeliveredOrderStatus(status) || isCanceledOrderStatus(status);
}

function sumFinance(finance: FinanceEntry[], type: FinanceEntry["type"]) {
  return finance.filter((entry) => entry.type === type).reduce((sum, entry) => sum + entry.value, 0);
}

function reportValue(section: Record<string, number> | undefined, key: string, fallback: number) {
  const value = section?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function DashboardView({
  overview,
  orders,
  finance,
  inventory,
  notifications,
  sectors,
  onOpenModal,
  onViewChange,
  onRefreshData,
  onClearReadNotifications,
}: {
  overview: DashboardOverview | null;
  orders: Order[];
  finance: FinanceEntry[];
  inventory: InventoryItem[];
  notifications: NotificationItem[];
  sectors: Sector[];
  onOpenModal: (mode: Exclude<ModalMode, null>) => void;
  onViewChange: (view: ViewKey) => void;
  onRefreshData: () => void;
  onClearReadNotifications: () => void;
}) {
  const receivable = sumFinance(finance, "receivable");
  const orderRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const revenue = overview?.totals.revenue ?? (orderRevenue || receivable);
  const lowStock = inventory.filter((item) => item.quantity < item.minQuantity).length;
  const activeOrders = orders.filter((order) => !isClosedOrderStatus(order.status));
  const deliveredOrders = orders.filter((order) => isDeliveredOrderStatus(order.status)).length;
  const unreadNotifications = notifications.filter((item) => !item.read).length;
  const totals = overview?.totals;
  const statusCounts = orderStatusCounts(orders);
  const ordersSeries = chartSeries(statusCounts.map((item) => item.count));
  const revenueChartData = cumulativeSeriesFrom(orders.length ? orders.map((order) => order.total) : finance.map((entry) => entry.value));
  const productionSeries = chartSeries(
    sectors.length ? sectors.map((sector) => sector.orders) : activeOrders.map((order) => order.progress),
  );
  const deliverySeries = chartSeries([
    orders.filter((order) => order.status === "approval").length,
    orders.filter((order) => order.status === "payment").length,
    orders.filter((order) => order.status === "production").length,
    orders.filter((order) => order.status === "conference").length,
    orders.filter((order) => order.status === "shipping").length,
    deliveredOrders,
  ]);
  const alertSeries = chartSeries([
    lowStock,
    unreadNotifications,
    notifications.filter((item) => item.tone === "danger").length,
    notifications.filter((item) => item.tone === "warning").length,
  ]);

  return (
    <>
      <section className="database-action-cards" aria-label="Acoes de banco e operacao">
        <DatabaseActionCard
          icon={RefreshCw}
          title="Banco"
          description="Sincronizar dados"
          detail={`${formatNumber(orders.length)} pedidos carregados`}
          tone="#236dff"
          onClick={onRefreshData}
        />
        <DatabaseActionCard
          icon={UserPlus}
          title="Cadastros"
          description="Novo cliente"
          detail="Cliente, produto e pedido"
          tone="#10b95b"
          onClick={() => onOpenModal("client")}
        />
        <DatabaseActionCard
          icon={Trash2}
          title="Exclusoes"
          description="Limpar lidos"
          detail="Requer confirmacao"
          tone="#ee3045"
          danger
          onClick={onClearReadNotifications}
        />
        <DatabaseActionCard
          icon={BellRing}
          title="Avisos"
          description={`${formatNumber(unreadNotifications)} pendente(s)`}
          detail={`${formatNumber(notifications.length)} no painel`}
          tone="#ff7a00"
          onClick={() => onViewChange("notifications")}
        />
      </section>

      <section className="kpi-grid">
        <MetricCard
          title="Pedidos"
          value={formatNumber(totals?.orders ?? orders.length)}
          detail={`${formatNumber(totals?.openOrders ?? activeOrders.length)} em aberto`}
          tone="#5b45ff"
          Icon={ShoppingBag}
          data={ordersSeries}
        />
        <MetricCard
          title="Faturamento"
          value={formatCurrency(revenue)}
          detail={`${formatNumber(finance.length)} lancamentos`}
          tone="#10b95b"
          Icon={DollarSign}
          data={revenueChartData}
        />
        <MetricCard
          title="Produção"
          value={formatNumber(totals?.productionOrders ?? activeOrders.filter((order) => order.status === "production").length)}
          detail="Em andamento"
          tone="#ff7a00"
          Icon={Factory}
          data={productionSeries}
        />
        <MetricCard
          title="Entregas"
          value={formatNumber(deliveredOrders)}
          detail={`${formatNumber(orders.filter((order) => order.status === "shipping").length)} em expedicao`}
          tone="#0a84ff"
          Icon={Truck}
          data={deliverySeries}
        />
        <MetricCard
          title="Alertas"
          value={formatNumber(lowStock + unreadNotifications)}
          detail="Requer atenção"
          tone="#ff3045"
          Icon={AlertTriangle}
          data={alertSeries}
        />
      </section>

      <section className="dashboard-grid top">
        <SectionCard title="Pedidos por Status" action={<span>Total: {orders.length} pedidos</span>}>
          <StatusDonut orders={orders} />
        </SectionCard>

        <SectionCard
          title="Produção em Andamento"
          action={
            <button className="ghost-button" type="button" onClick={() => onViewChange("production")}>
              Ver todas
            </button>
          }
          className="wide"
        >
          <ProductionMiniTable orders={activeOrders.slice(0, 5)} />
        </SectionCard>

        <SectionCard
          title="Faturamento"
          action={
            <button className="ghost-button" type="button" onClick={() => onViewChange("reports")}>
              Ver relatório
            </button>
          }
        >
          <div className="revenue-title">
            <strong>{formatCurrency(revenue)}</strong>
            <span>Dados consolidados dos pedidos e lancamentos</span>
          </div>
          <AreaChart data={revenueChartData} color="#4f46ff" />
          <div className="chart-axis">
            <span>Inicio</span>
            <span>Pedidos</span>
            <span>Hoje</span>


          </div>
        </SectionCard>
      </section>

      <section className="dashboard-grid bottom">
        <SectionCard
          title="Alertas e Notificações"
          action={
            <button className="ghost-button" type="button" onClick={() => onViewChange("notifications")}>
              Ver todas notificações
            </button>
          }
        >
          <NotificationPreview notifications={notifications.slice(0, 3)} />
        </SectionCard>

        <SectionCard
          title="Setores da Gráfica"
          action={
            <button className="ghost-button" type="button" onClick={() => onViewChange("sectors")}>
              Ver todos os setores
            </button>
          }
          className="wide"
        >
          <SectorBars sectors={sectors} />
        </SectionCard>

        <SectionCard
          title="Financeiro"
          action={
            <button className="ghost-button" type="button" onClick={() => onViewChange("finance")}>
              Ver financeiro
            </button>
          }
        >
          <FinancePreview finance={finance} revenue={revenue} />
        </SectionCard>
      </section>

      <section className="quick-actions" aria-label="Ações rápidas">
        <QuickAction icon={ClipboardList} label="Novo Pedido" onClick={() => onOpenModal("order")} tone="#5b45ff" />
        <QuickAction icon={Users} label="Novo Cliente" onClick={() => onOpenModal("client")} tone="#08a841" />
        <QuickAction icon={Package} label="Novo Produto" onClick={() => onOpenModal("product")} tone="#ff7800" />
        <QuickAction icon={FileText} label="Nova OP" onClick={() => onViewChange("production")} tone="#0a84ff" />
        <QuickAction icon={CreditCard} label="Nova Despesa" onClick={() => onOpenModal("expense")} tone="#ee3045" />
        <QuickAction icon={Upload} label="Upload de Arquivo" onClick={() => onOpenModal("file")} tone="#5b45ff" />
      </section>
    </>
  );
}

function orderDueDate(order: Order): Date | null {
  if (order.dueDate && /^\d{4}-\d{2}-\d{2}/.test(order.dueDate)) {
    const date = new Date(`${order.dueDate.slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = order.delivery.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/);
  if (!match) return null;

  const year = Number(match[3] ?? new Date().getFullYear());
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]), 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function orderMatchesDateFilter(order: Order, filter: DateFilter) {
  if (filter === "all") return true;

  const dueDate = orderDueDate(order);
  if (!dueDate) return false;

  const diffDays = Math.ceil((dueDate.getTime() - todayAtNoon().getTime()) / 86_400_000);

  if (filter === "today") return diffDays === 0;
  if (filter === "next7") return diffDays >= 0 && diffDays <= 7;
  if (filter === "next30") return diffDays >= 0 && diffDays <= 30;
  return diffDays < 0 && !isClosedOrderStatus(order.status);
}

function daysUntilOrder(order: Order) {
  const dueDate = orderDueDate(order);
  if (!dueDate) return null;
  return Math.ceil((dueDate.getTime() - todayAtNoon().getTime()) / 86_400_000);
}

function orderDeliveryDetail(order: Order) {
  if (isDeliveredOrderStatus(order.status)) return "entregue";
  if (isCanceledOrderStatus(order.status)) return "cancelado";
  const days = daysUntilOrder(order);
  if (days === null) return "prazo a confirmar";
  if (days < 0) return `${Math.abs(days)} dias atrasado`;
  if (days === 0) return "vence hoje";
  return `em ${days} dias`;
}

function percentText(value: number, total: number) {
  if (!total) return "0%";
  return `${((value / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function OrderMetricCard({
  icon: Icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className="order-summary-card" style={{ "--order-tone": tone } as CSSProperties}>
      <span>
        <Icon size={28} />
      </span>
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </article>
  );
}

function OrdersView({
  orders,
  onCreateOrder,
  onOpenOrder,
  onUpdateStatus,
}: {
  orders: Order[];
  onCreateOrder: () => void;
  onOpenOrder: (orderId: string) => void;
  onUpdateStatus: (orderId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Order["priority"]>("all");
  const visibleOrders = orders.filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (priorityFilter !== "all" && order.priority !== priorityFilter) return false;
    return true;
  });
  const priorityOptions = Array.from(new Set(orders.map((order) => order.priority)));
  const totalValue = visibleOrders.reduce((sum, order) => sum + order.total, 0);
  const totalItems = visibleOrders.reduce((sum, order) => sum + (order.quantity || 0), 0);
  const productionCount = visibleOrders.filter((order) => order.status === "production").length;
  const deliveredCount = visibleOrders.filter((order) => isDeliveredOrderStatus(order.status)).length;
  const deliveryDays = visibleOrders
    .map(daysUntilOrder)
    .filter((days): days is number => typeof days === "number" && days >= 0);
  const averageDelivery = deliveryDays.length
    ? deliveryDays.reduce((sum, days) => sum + days, 0) / deliveryDays.length
    : 0;

  return (
    <section className="orders-page">
      <div className="orders-summary-grid">
        <OrderMetricCard
          icon={ClipboardList}
          title="Total de pedidos"
          value={formatNumber(visibleOrders.length)}
          detail={`${percentText(visibleOrders.length, orders.length)} deste período`}
          tone="#6b45ff"
        />
        <OrderMetricCard
          icon={Package}
          title="Total de itens"
          value={formatNumber(totalItems)}
          detail={`${percentText(totalItems, totalItems)} de itens`}
          tone="#ff7208"
        />
        <OrderMetricCard
          icon={ChartNoAxesColumn}
          title="Valor total"
          value={formatCurrency(totalValue)}
          detail={`${percentText(visibleOrders.length, orders.length)} deste período`}
          tone="#18a957"
        />
        <OrderMetricCard
          icon={Truck}
          title="Em produção"
          value={formatNumber(productionCount)}
          detail={`${percentText(productionCount, visibleOrders.length)} do total`}
          tone="#236dff"
        />
        <OrderMetricCard
          icon={CalendarDays}
          title="Entrega média"
          value={`${averageDelivery.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`}
          detail="Prazo estimado"
          tone="#6b45ff"
        />
      </div>

      <section className="table-card orders-table-card">
        <div className="orders-table-toolbar">
          <div>
            <strong>{visibleOrders.length} pedidos</strong>
            <span>Pipeline comercial e operacional</span>
          </div>
          <div className="orders-toolbar-actions">
            <label className="filter-select-control">
              <Funnel size={17} />
              <span className="sr-only">Filtrar status</span>
              <select
                aria-label="Filtrar status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}
              >
                <option value="all">Todos os status</option>
                {(Object.keys(statusMeta) as OrderStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {statusMeta[status].label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
            <label className="filter-select-control">
              <Tag size={17} />
              <span className="sr-only">Filtrar prioridade</span>
              <select
                aria-label="Filtrar prioridade"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as "all" | Order["priority"])}
              >
                <option value="all">Todas as prioridades</option>
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
            <button className="primary-button" type="button" onClick={onCreateOrder}>
              <Plus size={18} />
              Novo Pedido
            </button>
          </div>
        </div>

        <div className="orders-table-scroll no-scrollbar">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Produto</th>
                <th>Status</th>
                <th>Total</th>
                <th>Entrega</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const publicLink = publicOrderLink(order);

                return (
                <tr
                  className="clickable-row order-table-row"
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenOrder(order.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenOrder(order.id);
                    }
                  }}
                >
                  <td>
                    <div className="order-id-cell">
                      <span>
                        <FileText size={18} />
                      </span>
                      <div>
                        <strong>{order.number ?? order.id}</strong>
                        <small>{order.delivery} · 10:{String(Math.max(10, 35 - visibleOrders.indexOf(order) * 2)).padStart(2, "0")}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="order-client-cell">
                      <Building2 size={15} />
                      <span>{order.customer}</span>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack order-product-cell">
                      <span>{order.product}</span>
                      <small>{formatNumber(order.quantity)} un</small>
                    </div>
                  </td>
                  <td>
                    <StatusPill status={order.status} />
                  </td>
                  <td>
                    <strong className="order-total-cell">{formatCurrency(order.total)}</strong>
                  </td>
                  <td>
                    <div className="order-delivery-cell">
                      <span>
                        <CalendarDays size={15} />
                        {order.delivery}
                      </span>
                      <small>{orderDeliveryDetail(order)}</small>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions order-row-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Editar pedido ${order.number ?? order.id}`}
                        title="Editar pedido"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenOrder(order.id);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Avançar pedido ${order.number ?? order.id}`}
                        title="Atualizar status"
                        onClick={(event) => {
                          event.stopPropagation();
                          onUpdateStatus(order.id);
                        }}
                      >
                        <Check size={16} />
                      </button>
                      {publicLink ? (
                        <>
                          <a
                            className="icon-button"
                            href={publicLink}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Abrir link público do pedido ${order.number ?? order.id}`}
                            title="Abrir link público"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Eye size={16} />
                          </a>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Copiar link público do pedido ${order.number ?? order.id}`}
                            title="Copiar link público"
                            onClick={(event) => {
                              event.stopPropagation();
                              void navigator.clipboard?.writeText(publicLink);
                            }}
                          >
                            <Link2 size={16} />
                          </button>
                        </>
                      ) : null}
                      <button
                        className="icon-button ghost-dots"
                        type="button"
                        aria-label={`Mais ações do pedido ${order.number ?? order.id}`}
                        title="Mais ações"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreVertical size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="orders-pagination">
          <span>Mostrando 1 a {orders.length} de {orders.length} pedidos</span>
          <div>
            <button className="icon-button" type="button" aria-label="Pagina anterior" disabled>
              <ChevronLeft size={17} />
            </button>
            <button className="orders-page-number" type="button">1</button>
            <button className="icon-button" type="button" aria-label="Proxima pagina" disabled={orders.length <= 6}>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}

function ProductionView({
  orders,
  stages,
  focusCreateSignal,
  onCreateStage,
  onRenameStage,
  onRemoveStage,
  onMoveOrder,
  onOpenOrder,
}: {
  orders: Order[];
  stages: ProductionStage[];
  focusCreateSignal: number;
  onCreateStage: (name: string) => void;
  onRenameStage: (stageId: string, name: string) => void;
  onRemoveStage: (stageId: string) => void;
  onMoveOrder: (orderId: string, stageId: string) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const [stageName, setStageName] = useState("");
  const [editingStage, setEditingStage] = useState<{ id: string; name: string } | null>(null);
  const createStageInputRef = useRef<HTMLInputElement>(null);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dropStageId, setDropStageId] = useState<string | null>(null);

  useEffect(() => {
    if (focusCreateSignal > 0) {
      createStageInputRef.current?.focus();
    }
  }, [focusCreateSignal]);

  function handleCreateStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreateStage(stageName);
    setStageName("");
  }

  function handleSaveStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingStage) {
      return;
    }

    onRenameStage(editingStage.id, editingStage.name);
    setEditingStage(null);
  }

  return (
    <section className="production-page">
      <div className="production-toolbar">
        <div className="production-summary">
          <span>{orders.length} pedidos</span>
          <strong>{stages.length} estágios</strong>
        </div>
        <form className="stage-create-form" onSubmit={handleCreateStage}>
          <input
            ref={createStageInputRef}
            aria-label="Nome do novo estágio"
            value={stageName}
            placeholder="Novo estágio"
            onChange={(event) => setStageName(event.target.value)}
          />
          <button className="primary-button" type="submit">
            <Plus size={17} />
            Estágio
          </button>
        </form>
      </div>

      <div className="production-kanban" aria-label="Kanban de produção">
        {stages.map((stage) => {
          const stageOrders = stage.status
            ? orders.filter((order) => order.status === stage.status)
            : orders.filter((order) => order.stageId === stage.id);
          const isEditing = editingStage?.id === stage.id;

          return (
            <section
              className={`kanban-column ${dropStageId === stage.id ? "is-drop-target" : ""}`}
              key={stage.id}
              style={{ "--stage": stage.color } as CSSProperties}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={() => setDropStageId(stage.id)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDropStageId(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const orderId = event.dataTransfer.getData("text/plain") || draggingOrderId;

                if (orderId) {
                  onMoveOrder(orderId, stage.id);
                }

                setDraggingOrderId(null);
                setDropStageId(null);
              }}
            >
              <div className="kanban-column-head">
                {isEditing ? (
                  <form className="stage-edit-form" onSubmit={handleSaveStage}>
                    <input
                      aria-label="Editar estágio"
                      autoFocus
                      value={editingStage.name}
                      onChange={(event) =>
                        setEditingStage((current) =>
                          current ? { ...current, name: event.target.value } : current,
                        )
                      }
                    />
                    <button className="icon-button" type="submit" aria-label="Salvar estágio" title="Salvar estágio">
                      <Save size={16} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Cancelar edição"
                      title="Cancelar edição"
                      onClick={() => setEditingStage(null)}
                    >
                      <X size={16} />
                    </button>
                  </form>
                ) : (
                  <>
                    <div>
                      <strong>{stage.name}</strong>
                      <span>{stageOrders.length} pedidos</span>
                    </div>
                    <div className="stage-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Editar estágio ${stage.name}`}
                        title="Editar estágio"
                        onClick={() => setEditingStage({ id: stage.id, name: stage.name })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Remover estágio ${stage.name}`}
                        title="Remover estágio"
                        onClick={() => onRemoveStage(stage.id)}
                        disabled={stages.length <= 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="kanban-cards">
                {stageOrders.length ? (
                  stageOrders.map((order) => (
                    <article
                      className={`kanban-card compact ${draggingOrderId === order.id ? "is-dragging" : ""}`}
                      key={order.id}
                      draggable
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenOrder(order.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenOrder(order.id);
                        }
                      }}
                      onDragStart={(event) => {
                        setDraggingOrderId(order.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", order.id);
                      }}
                      onDragEnd={() => {
                        setDraggingOrderId(null);
                        setDropStageId(null);
                      }}
                    >
                      <div className="card-head">
                        <span>{order.number ?? order.id}</span>
                        <PriorityTag priority={order.priority} />
                      </div>
                      <p>{order.customer}</p>
                    </article>
                  ))
                ) : (
                  <div className="kanban-empty">Sem pedidos</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function ClientsView({
  clients,
  onCreateClient,
}: {
  clients: Client[];
  onCreateClient: () => void;
}) {
  const [clientSearch, setClientSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState<"all" | Client["status"]>("all");
  const [clientTypeFilter, setClientTypeFilter] = useState<"all" | NonNullable<Client["personType"]>>("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const filteredClients = clients.filter((client) => {
    if (clientStatusFilter !== "all" && client.status !== clientStatusFilter) return false;
    if (clientTypeFilter !== "all" && client.personType !== clientTypeFilter) return false;

    const query = normalizeText(clientSearch);
    if (!query) return true;
    return normalizeText([
      client.name,
      client.company,
      client.document,
      client.documentType,
      client.email,
      client.phone,
      client.whatsapp,
      client.city,
      client.address?.street,
      client.address?.number,
    ].filter(Boolean).join(" ")).includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedClients = filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const clientStatusFilterLabel =
    clientStatusFilter === "all" ? "Todos os status" : clientStatusFilter === "Ativo" ? "Ativos" : clientStatusFilter;
  const clientTypeFilterLabel =
    clientTypeFilter === "all"
      ? "PF e PJ"
      : clientTypeFilter === "PF"
        ? "Pessoa física"
        : "Pessoa jurídica";

  return (
    <section className="clients-reference-page table-card">
      <div className="clients-reference-toolbar">
        <div className="clients-reference-title">
          <span>
            <Users size={30} />
          </span>
          <div>
            <strong>{formatNumber(filteredClients.length)} clientes</strong>
            <em>Página com 2 linhas de 4 cards</em>
          </div>
        </div>

        <label className="clients-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Buscar cliente, CNPJ, email ou telefone..."
            value={clientSearch}
            onChange={(event) => {
              setClientSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <div className="clients-toolbar-actions">
          <label className="filter-select-control client-filter-select">
            <Funnel size={17} />
            <span className="sr-only">Filtrar status do cliente</span>
            <span className="filter-select-value">{clientStatusFilterLabel}</span>
            <select
              aria-label="Filtrar status do cliente"
              value={clientStatusFilter}
              onChange={(event) => {
                setClientStatusFilter(event.target.value as "all" | Client["status"]);
                setPage(1);
              }}
            >
              <option value="all">Todos os status</option>
              <option value="Ativo">Ativos</option>
              <option value="Atenção">Atenção</option>
              <option value="Inativo">Inativos</option>
            </select>
            <ChevronDown size={15} />
          </label>
          <label className="filter-select-control client-filter-select">
            <Building2 size={17} />
            <span className="sr-only">Filtrar tipo do cliente</span>
            <span className="filter-select-value">{clientTypeFilterLabel}</span>
            <select
              aria-label="Filtrar tipo do cliente"
              value={clientTypeFilter}
              onChange={(event) => {
                setClientTypeFilter(event.target.value as "all" | NonNullable<Client["personType"]>);
                setPage(1);
              }}
            >
              <option value="all">PF e PJ</option>
              <option value="PF">Pessoa física</option>
              <option value="PJ">Pessoa jurídica</option>
            </select>
            <ChevronDown size={15} />
          </label>
        </div>
      </div>

      <div className={`clients-card-grid count-${Math.min(Math.max(paginatedClients.length, 1), 4)}`}>
        {paginatedClients.map((client) => {
          const addressLine = client.address?.street
            ? `${client.address.street}${client.address.number ? `, ${client.address.number}` : ""}`
            : client.city || "Endereço não informado";
          const clientInitial = (client.name || client.company || "C").slice(0, 1).toUpperCase();

          return (
            <article className="client-reference-card" key={client.id}>
              <div className="client-reference-head">
                <span>{client.company || client.name}</span>
                <ClientStatus status={client.status} />
              </div>

              <div className="client-reference-identity">
                <div className="client-reference-avatar" aria-hidden="true">
                  {clientInitial}
                  {client.avatarUrl ? (
                    <Image
                      src={client.avatarUrl}
                      alt=""
                      fill
                      sizes="74px"
                      unoptimized
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                </div>
                <div>
                  <h3>{client.name}</h3>
                  <p>{client.documentType ?? "Doc."} {client.document ?? "não informado"}</p>
                </div>
              </div>

              <div className="client-address-line">
                <MapPin size={17} />
                <span>{addressLine}</span>
              </div>

              <div className="client-contact-list">
                <span>
                  <Mail size={18} />
                  {client.email || "Email não informado"}
                </span>
                <span>
                  <Phone size={18} />
                  {client.phone || "Telefone não informado"}
                </span>
                <span>
                  <MessageCircle size={18} />
                  {client.whatsapp || client.phone || "WhatsApp não informado"}
                </span>
              </div>

              <div className="client-reference-metrics">
                <span className="orders">
                  <ShoppingBag size={22} />
                  <strong>{formatNumber(client.orders)}</strong>
                  <em>pedidos</em>
                </span>
                <span className="revenue">
                  <CircleDollarSign size={26} />
                  <strong>{formatCurrency(client.revenue)}</strong>
                  <em>receita</em>
                </span>
              </div>

              <button className="client-history-button" type="button">
                <span>
                  <CalendarDays size={18} />
                  Ver histórico
                </span>
                <ChevronRight size={22} />
              </button>
            </article>
          );
        })}

        {!paginatedClients.length ? (
          <div className="empty-state clients-empty-state">
            <Users size={22} />
            Nenhum cliente encontrado.
            <button className="primary-button compact" type="button" onClick={onCreateClient}>
              <UserPlus size={16} />
              Novo Cliente
            </button>
          </div>
        ) : null}
      </div>

      <div className="clients-pagination">
        <span>
          Página {currentPage} de {pageCount} · {filteredClients.length} {filteredClients.length === 1 ? "cliente" : "clientes"}
        </span>
        <div>
          <button className="ghost-button" type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Anterior
          </button>
          <button className="orders-page-number" type="button">{currentPage}</button>
          <button className="ghost-button" type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}
function SupportView({
  clients,
  orders,
  products,
  onCreateOrder,
  onCreateQuote,
  onViewChange,
}: {
  clients: Client[];
  orders: Order[];
  products: Product[];
  onCreateOrder: () => void;
  onCreateQuote: () => void;
  onViewChange: (view: ViewKey) => void;
}) {
  const supportConversations = useMemo(() => {
    const orderConversations = orders.slice(0, 8).map((order, index) => {
      const conversationClient = clients.find(
        (item) => item.name === order.customer || item.company === order.customer,
      );
      const conversationProduct = products.find(
        (item) => item.id === order.productId || item.name === order.product,
      );

      return {
        id: `order-${order.id}`,
        client: conversationClient,
        order,
        product: conversationProduct,
        name: conversationClient?.name ?? order.customer,
        company: conversationClient?.company ?? order.customer,
        preview: `${order.number ?? order.id} · ${order.product}`,
        time: index === 0 ? "Agora" : `${9 + index}:3${index}`,
        unread: index === 0 ? 2 : 0,
      };
    });

    const namesInOrders = new Set(orderConversations.map((conversation) => conversation.name));
    const clientConversations = clients
      .filter((item) => !namesInOrders.has(item.name))
      .slice(0, Math.max(0, 8 - orderConversations.length))
      .map((conversationClient, index) => ({
        id: `client-${conversationClient.id}`,
        client: conversationClient,
        order: undefined as Order | undefined,
        product: products[index % Math.max(products.length, 1)],
        name: conversationClient.name,
        company: conversationClient.company,
        preview: "Aguardando retorno sobre orçamento",
        time: `${10 + index}:0${index}`,
        unread: !orderConversations.length && index === 0 ? 1 : 0,
      }));

    const conversations = [...orderConversations, ...clientConversations];
    return conversations.length
      ? conversations
      : [
          {
            id: "empty-support",
            client: undefined,
            order: undefined,
            product: products[0],
            name: "Novo cliente",
            company: "Atendimento",
            preview: "Inicie uma conversa pelo WhatsApp",
            time: "Agora",
            unread: 0,
          },
        ];
  }, [clients, orders, products]);
  const [selectedConversationId, setSelectedConversationId] = useState("");

  const activeConversation =
    supportConversations.find((conversation) => conversation.id === selectedConversationId) ??
    supportConversations[0];
  const activeOrder =
    activeConversation?.order ?? orders.find((order) => !isClosedOrderStatus(order.status)) ?? orders[0];
  const client =
    activeConversation?.client ??
    clients.find((item) => item.name === activeOrder?.customer || item.company === activeOrder?.customer) ??
    clients[0];
  const product =
    activeConversation?.product ??
    products.find((item) => item.id === activeOrder?.productId || item.name === activeOrder?.product) ??
    products[0];
  const relatedProducts = products
    .filter((item) => item.id !== product?.id)
    .slice(0, 4);
  const firstName = activeConversation?.name?.split(" ")[0] ?? client?.name?.split(" ")[0] ?? "Cliente";
  const orderNumber = activeOrder?.number ?? activeOrder?.id ?? "#12458";
  const orderValue = activeOrder?.total ?? product?.price ?? 0;
  const productName = product?.name ?? activeOrder?.product ?? "Panfleto A5";
  const productDetail = product
    ? `${product.category} · minimo ${formatNumber(product.minOrderQty)} un`
    : "4x4 cores · Couche 115g";

  return (
    <section className="support-page">
      <div className="support-chat-area">
        <aside className="support-conversations-panel" aria-label="Conversas de atendimento">
          <div className="support-conversations-head">
            <div>
              <strong>Conversas</strong>
              <span>{supportConversations.length} atendimentos</span>
            </div>
            <button type="button" aria-label="Nova conversa" title="Nova conversa" onClick={onCreateOrder}>
              <Plus size={16} />
            </button>
          </div>

          <div className="support-conversation-list">
            {supportConversations.map((conversation) => (
              <button
                className={`support-conversation-item ${activeConversation?.id === conversation.id ? "active" : ""}`}
                key={conversation.id}
                type="button"
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                <div
                  className="support-conversation-avatar"
                  style={conversation.client?.avatarUrl ? { backgroundImage: `url(${conversation.client.avatarUrl})` } : undefined}
                >
                  {!conversation.client?.avatarUrl ? conversation.name.slice(0, 2).toUpperCase() : null}
                </div>
                <div>
                  <span>
                    <strong>{conversation.name}</strong>
                    <small>{conversation.time}</small>
                  </span>
                  <p>{conversation.preview}</p>
                  <em>{conversation.order ? statusMeta[conversation.order.status].label : "Novo atendimento"}</em>
                </div>
                {conversation.unread ? <i>{conversation.unread}</i> : null}
              </button>
            ))}
          </div>
        </aside>

        <div className="support-chat-shell" aria-label="Atendimento via WhatsApp">
          <header className="support-chat-header">
            <div className="support-chat-title">
              <span className="support-whatsapp-mark">
                <MessageCircle size={19} />
              </span>
              <div>
                <strong>Atendimento via WhatsApp</strong>
                <span>
                  <i />
                  Online agora
                </span>
              </div>
            </div>
            <div className="support-chat-actions">
              <button className="support-header-button" type="button" aria-label="Mais opcoes" title="Mais opcoes">
                <MoreVertical size={18} />
              </button>
              <button className="support-header-button" type="button" aria-label="Fechar conversa" title="Fechar conversa">
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="support-chat-body">
            <SupportChatMessage
              avatarUrl={GRAPHFLOW_LOGO_SRC}
              name="Grafica Exemplo"
              time="10:20"
              tone="agent"
            >
              Ola, {firstName}! Como podemos ajudar voce hoje?
            </SupportChatMessage>

            <SupportChatMessage
              avatarUrl={client?.avatarUrl}
              name={client?.name ?? "Cliente"}
              time="10:31"
              tone="customer"
            >
              Gostaria de fazer um orcamento de {formatNumber(activeOrder?.quantity ?? product?.minOrderQty ?? 1000)} unidades com acabamento frente e verso.
            </SupportChatMessage>

            <SupportChatMessage
              avatarUrl={GRAPHFLOW_LOGO_SRC}
              name="Grafica Exemplo"
              time="10:32"
              tone="agent"
            >
              Perfeito. Me informe o tamanho, o tipo de papel desejado e se a arte ja esta pronta.
            </SupportChatMessage>

            <SupportChatMessage
              avatarUrl={client?.avatarUrl}
              name={client?.name ?? "Cliente"}
              time="10:34"
              tone="customer"
            >
              Pode usar {productDetail}. Preciso receber com prazo curto e acompanhar o pedido.
            </SupportChatMessage>

            <SupportChatMessage
              avatarUrl={GRAPHFLOW_LOGO_SRC}
              name="Grafica Exemplo"
              time="10:35"
              tone="agent"
            >
              <span>Otimo. Ja vou preparar seu atendimento com base no pedido em aberto.</span>
              <div className="support-quote-card">
                <div>
                  <span>Orcamento {orderNumber}</span>
                  <strong>Pronto</strong>
                </div>
                <p>{formatNumber(activeOrder?.quantity ?? product?.minOrderQty ?? 1000)} unidades · {productName}</p>
                <strong>{formatCurrency(orderValue)}</strong>
                <button className="support-quote-button" type="button" onClick={onCreateQuote}>
                  Ver orcamento completo
                </button>
              </div>
            </SupportChatMessage>
          </div>

          <div className="support-quick-actions" aria-label="Acoes rapidas de atendimento">
            <button type="button" onClick={() => onViewChange("catalog")}>
              <BookOpen size={16} />
              Ver catalogo
            </button>
            <button type="button" onClick={() => onViewChange("orders")}>
              <ShoppingBag size={16} />
              Meus pedidos
            </button>
            <button type="button" onClick={onCreateQuote}>
              <FileText size={16} />
              Gerar orcamento
            </button>
            <button type="button" onClick={() => onViewChange("files")}>
              <Paperclip size={16} />
              Anexos
            </button>
          </div>

          <form className="support-chat-compose" onSubmit={(event) => event.preventDefault()}>
            <button className="support-compose-icon" type="button" aria-label="Anexar arquivo" title="Anexar arquivo">
              <Paperclip size={18} />
            </button>
            <input placeholder="Digite sua mensagem..." aria-label="Mensagem" />
            <button className="support-send-button" type="submit">
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      <aside className="support-context-panel" aria-label="Contexto do atendimento">
        <section className="support-context-card client">
          <div className="support-context-head">
            <span>Cliente em atendimento</span>
            <strong>Online</strong>
          </div>
          <div className="support-client-line">
            <div
              className="support-client-avatar"
              style={client?.avatarUrl ? { backgroundImage: `url(${client.avatarUrl})` } : undefined}
            >
              {!client?.avatarUrl ? (client?.name ?? "CL").slice(0, 2).toUpperCase() : null}
            </div>
            <div>
              <strong>{client?.name ?? "Cliente novo"}</strong>
              <span>{client?.company ?? "Cadastro em andamento"}</span>
            </div>
          </div>
          <div className="support-contact-list">
            <span>
              <Phone size={15} />
              {client?.whatsapp ?? client?.phone ?? "(11) 99999-9999"}
            </span>
            <span>
              <Mail size={15} />
              {client?.email ?? "email@exemplo.com"}
            </span>
          </div>
        </section>

        <section className="support-context-card product">
          <div className="support-context-head">
            <span>Pedido em foco</span>
            <strong>{orderNumber}</strong>
          </div>
          <div className="support-product-preview">
            <div
              className="support-product-thumb"
              style={product?.thumbnailUrl ? { backgroundImage: `url(${product.thumbnailUrl})` } : undefined}
            >
              {!product?.thumbnailUrl ? <Package size={24} /> : null}
            </div>
            <div>
              <strong>{productName}</strong>
              <span>{productDetail}</span>
            </div>
          </div>
          <div className="support-summary-list">
            <span>
              Quantidade
              <strong>{formatNumber(activeOrder?.quantity ?? product?.minOrderQty ?? 0)}</strong>
            </span>
            <span>
              Entrega
              <strong>{activeOrder?.delivery ?? "A definir"}</strong>
            </span>
            <span>
              Total estimado
              <strong>{formatCurrency(orderValue)}</strong>
            </span>
          </div>
        </section>

        <section className="support-context-card actions">
          <div className="support-context-head">
            <span>Acoes do atendimento</span>
            <strong>Fila ativa</strong>
          </div>
          <button className="primary-button wide" type="button" onClick={onCreateQuote}>
            <FileText size={18} />
            Criar orcamento
          </button>
          <button className="ghost-button support-action" type="button" onClick={onCreateOrder}>
            <ClipboardList size={17} />
            Novo pedido
          </button>
          <button className="ghost-button support-action" type="button" onClick={() => onViewChange("clients")}>
            <Users size={17} />
            Abrir cadastro
          </button>
        </section>

        {relatedProducts.length ? (
          <section className="support-context-card related">
            <div className="support-context-head">
              <span>Produtos relacionados</span>
              <button type="button" onClick={() => onViewChange("catalog")}>
                Ver catalogo
              </button>
            </div>
            <div className="support-related-grid">
              {relatedProducts.map((item) => (
                <article key={item.id}>
                  <div
                    className="support-related-thumb"
                    style={item.thumbnailUrl ? { backgroundImage: `url(${item.thumbnailUrl})` } : undefined}
                  >
                    {!item.thumbnailUrl ? <Package size={18} /> : null}
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{formatCurrency(item.price)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </section>
  );
}

function SupportChatMessage({
  avatarUrl,
  name,
  time,
  tone,
  children,
}: {
  avatarUrl?: string;
  name: string;
  time: string;
  tone: "agent" | "customer";
  children: ReactNode;
}) {
  return (
    <article className={`support-message ${tone}`}>
      <div
        className="support-message-avatar"
        style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
        aria-hidden="true"
      >
        {!avatarUrl ? name.slice(0, 2).toUpperCase() : null}
      </div>
      <div className="support-message-content">
        <div className="support-message-meta">
          <strong>{name}</strong>
          <span>{time}</span>
        </div>
        <div className="support-bubble">{children}</div>
      </div>
    </article>
  );
}

const permissionOptions: Array<{ key: PermissionKey; label: string }> = (
  Object.keys(PERMISSION_LABELS) as PermissionKey[]
).map((key) => ({ key, label: PERMISSION_LABELS[key] }));

function UsersView({
  users,
  sectors,
  onUploadFile,
  onCreateUser,
  onUpdateUser,
  onUpdatePassword,
  onDeleteUser,
}: {
  users: UserAccount[];
  sectors: Sector[];
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onCreateUser: () => void;
  onUpdateUser: (id: string, update: Partial<Omit<UserAccount, "id" | "tenantId">>) => Promise<void>;
  onUpdatePassword: (id: string, password: string) => Promise<void>;
  onDeleteUser: (id: string) => void | Promise<void>;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [userDrafts, setUserDrafts] = useState<Record<string, Partial<UserAccount>>>({});
  const [contactSearch, setContactSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | UserAccount["status"]>("all");
  const [userTypeFilter, setUserTypeFilter] = useState<"all" | UserAccount["type"]>("all");
  const [page, setPage] = useState(1);
  const pageSize = 4;
  const selectedUser = selectedUserId ? users.find((user) => user.id === selectedUserId) : undefined;
  const filteredUsers = users.filter((user) => {
    if (userStatusFilter !== "all" && user.status !== userStatusFilter) return false;
    if (userTypeFilter !== "all" && user.type !== userTypeFilter) return false;

    const query = normalizeText(contactSearch);
    if (!query) return true;
    const sectorNames = sectors
      .filter((sector) => user.sectorIds.includes(sector.id))
      .map((sector) => sector.name)
      .join(" ");

    return normalizeText([
      user.name,
      user.email,
      user.phone,
      user.whatsapp,
      user.department,
      user.jobTitle,
      user.role,
      user.type,
      user.document,
      sectorNames,
    ].filter(Boolean).join(" ")).includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const fromItem = filteredUsers.length ? (currentPage - 1) * pageSize + 1 : 0;
  const toItem = Math.min(currentPage * pageSize, filteredUsers.length);

  function userEditDraft(user: UserAccount): Partial<UserAccount> {
    return {
      ...user,
      address: {
        zip: user.address?.zip ?? "",
        street: user.address?.street ?? "",
        number: user.address?.number ?? "",
        complement: user.address?.complement ?? "",
        district: user.address?.district ?? "",
        city: user.address?.city ?? "",
        state: user.address?.state ?? "",
        country: user.address?.country ?? "BR",
      },
      permissions: [...user.permissions],
      sectorIds: [...user.sectorIds],
    };
  }

  function draftForUser(user: UserAccount): Partial<UserAccount> {
    return userDrafts[user.id] ?? userEditDraft(user);
  }

  function updateDraft(user: UserAccount, update: Partial<UserAccount>) {
    setUserDrafts((current) => ({ ...current, [user.id]: { ...draftForUser(user), ...update } }));
  }

  async function saveUser(user: UserAccount) {
    const draft = draftForUser(user);
    await onUpdateUser(user.id, {
      type: draft.type,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      document: draft.document,
      avatarUrl: draft.avatarUrl,
      whatsapp: draft.whatsapp,
      personalEmail: draft.personalEmail,
      birthDate: draft.birthDate,
      address: draft.address,
      department: draft.department,
      jobTitle: draft.jobTitle,
      admissionDate: draft.admissionDate,
      supervisor: draft.supervisor,
      shift: draft.shift,
      costCenter: draft.costCenter,
      bank: draft.bank,
      bankAccount: draft.bankAccount,
      pixKey: draft.pixKey,
      notes: draft.notes,
      profileComplete: Boolean(draft.profileComplete),
      role: draft.role,
      permissions: draft.permissions,
      sectorIds: draft.sectorIds,
      status: draft.status,
    });
  }

  function openUser(user: UserAccount) {
    setUserDrafts((current) => ({ ...current, [user.id]: userEditDraft(user) }));
    setPasswordDraft("");
    setSelectedUserId(user.id);
  }

  function userRoleLabel(user: UserAccount) {
    if (user.jobTitle) return user.jobTitle;
    if (user.role === "ADMIN") return "Administrador";
    if (user.role === "MANAGER") return "Gerente";
    if (user.role === "FINANCE") return "Financeiro";
    if (user.role === "CLIENT") return "Cliente";
    return "Operador";
  }

  function userTypeLabel(user: UserAccount) {
    if (user.type === "CLIENT") return "Cliente";
    if (user.type === "ADMIN") return "Admin";
    return "Operador";
  }

  function userStatusLabel(user: UserAccount) {
    if (user.status === "Convidado") return "Em negociação";
    return user.status;
  }

  function userSince(user: UserAccount) {
    const value = user.admissionDate || user.createdAt || "";
    if (!value) return "sem data";
    const normalized = value.includes("T") ? value.slice(0, 10) : value;
    const [year, month] = normalized.split("-");
    const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const monthIndex = Number(month) - 1;
    if (year && monthNames[monthIndex]) return `${monthNames[monthIndex]}/${year}`;
    return value;
  }

  return (
    <section className="contacts-page table-card">
      <div className="contacts-toolbar">
        <label className="contacts-search">
          <Search size={22} />
          <input
            type="search"
            placeholder="Buscar por nome, email, empresa ou telefone..."
            value={contactSearch}
            onChange={(event) => {
              setContactSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="filter-select-control contacts-filter-button">
          <Funnel size={20} />
          <span className="sr-only">Filtrar status do contato</span>
          <select
            aria-label="Filtrar status do contato"
            value={userStatusFilter}
            onChange={(event) => {
              setUserStatusFilter(event.target.value as "all" | UserAccount["status"]);
              setPage(1);
            }}
          >
            <option value="all">Todos os status</option>
            <option value="Ativo">Ativos</option>
            <option value="Convidado">Convidados</option>
            <option value="Suspenso">Suspensos</option>
            <option value="Inativo">Inativos</option>
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="filter-select-control contacts-filter-button">
          <UserCog size={20} />
          <span className="sr-only">Filtrar tipo do contato</span>
          <select
            aria-label="Filtrar tipo do contato"
            value={userTypeFilter}
            onChange={(event) => {
              setUserTypeFilter(event.target.value as "all" | UserAccount["type"]);
              setPage(1);
            }}
          >
            <option value="all">Todos os tipos</option>
            <option value="ADMIN">Administradores</option>
            <option value="OPERATOR">Operadores</option>
            <option value="CLIENT">Clientes</option>
          </select>
          <ChevronDown size={15} />
        </label>
      </div>

      <div className="contacts-list">
        {paginatedUsers.map((user) => {
          const sectorNames = sectors
            .filter((sector) => user.sectorIds.includes(sector.id))
            .map((sector) => sector.name);
          const organization = user.department || "GraphFlow";
          const businessArea = sectorNames[0] || user.shift || user.role;
          const avatarInitials = user.name.slice(0, 2).toUpperCase();
          const typeLabel = userTypeLabel(user);
          const statusLabel = userStatusLabel(user);

          return (
            <article className="contact-row" key={user.id}>
              <div className="contact-avatar" aria-hidden="true">
                {avatarInitials}
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    fill
                    sizes="106px"
                    unoptimized
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>

              <div className="contact-content">
                <h3>{user.name}</h3>
                <p>{userRoleLabel(user)} <span aria-hidden="true">•</span> {organization}</p>
                <div className="contact-line">
                  <span>
                    <Mail size={17} />
                    {user.email}
                  </span>
                  <i aria-hidden="true" />
                  <span>
                    <Phone size={17} />
                    {user.whatsapp || user.phone || "Telefone não informado"}
                  </span>
                </div>
                <div className="contact-line secondary">
                  <span>
                    <Building2 size={17} />
                    {organization}
                  </span>
                  <i aria-hidden="true" />
                  <span>
                    <ChartNoAxesColumn size={17} />
                    {businessArea}
                  </span>
                  <i aria-hidden="true" />
                  <span>
                    <CalendarDays size={17} />
                    Desde {userSince(user)}
                  </span>
                  <span className={`contact-type-pill ${normalizeText(typeLabel)}`}>{typeLabel}</span>
                </div>
              </div>

              <span className={`contact-status ${normalizeText(statusLabel)}`}>{statusLabel}</span>

              <div className="contact-actions">
                <button className="ghost-button contact-edit-button" type="button" onClick={() => openUser(user)}>
                  <Pencil size={20} />
                  Editar
                </button>
                <button
                  className="icon-button contact-delete-button"
                  type="button"
                  aria-label={`Excluir ${user.name}`}
                  title="Excluir contato"
                  onClick={() => void onDeleteUser(user.id)}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </article>
          );
        })}

        {!paginatedUsers.length ? (
          <div className="empty-state contacts-empty-state">
            <Users size={22} />
            Nenhum contato encontrado.
            <button className="primary-button compact" type="button" onClick={onCreateUser}>
              <UserPlus size={16} />
              Novo contato
            </button>
          </div>
        ) : null}
      </div>

      <div className="contacts-pagination">
        <span>Mostrando {fromItem} a {toItem} de {filteredUsers.length} contatos</span>
        <div>
          <button className="icon-button" type="button" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            <ChevronLeft size={20} />
          </button>
          <button className="orders-page-number" type="button">{currentPage}</button>
          <button className="icon-button" type="button" aria-label="Próxima página" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {selectedUser ? (
        <UserProfileDrawer
          user={selectedUser}
          draft={draftForUser(selectedUser)}
          sectors={sectors}
          onUploadFile={onUploadFile}
          passwordDraft={passwordDraft}
          onDraftChange={(update) => updateDraft(selectedUser, update)}
          onPasswordDraftChange={setPasswordDraft}
          onSave={() => void saveUser(selectedUser)}
          onPasswordSubmit={async () => {
            const password = passwordDraft.trim();
            if (!password) return;
            await onUpdatePassword(selectedUser.id, password);
            setPasswordDraft("");
          }}
          onClose={() => setSelectedUserId(null)}
        />
      ) : null}
    </section>
  );
}
function UserProfileDrawer({
  user,
  draft,
  sectors,
  onUploadFile,
  passwordDraft,
  onDraftChange,
  onPasswordDraftChange,
  onSave,
  onPasswordSubmit,
  onClose,
}: {
  user: UserAccount;
  draft: Partial<UserAccount>;
  sectors: Sector[];
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  passwordDraft: string;
  onDraftChange: (update: Partial<UserAccount>) => void;
  onPasswordDraftChange: (value: string) => void;
  onSave: () => void;
  onPasswordSubmit: () => void | Promise<void>;
  onClose: () => void;
}) {
  const address: NonNullable<UserAccount["address"]> = {
    zip: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    country: "BR",
    ...(draft.address ?? {}),
  };
  const activeSectorIds = draft.sectorIds ?? [];
  const activePermissions = draft.permissions ?? [];
  const sectorNames = sectors
    .filter((sector) => activeSectorIds.includes(sector.id))
    .map((sector) => sector.name)
    .join(", ");
  const completedFields = [
    draft.name,
    draft.email,
    draft.phone,
    draft.document,
    draft.whatsapp,
    address.street,
    address.city,
    draft.department,
    draft.jobTitle,
    activeSectorIds.length ? "setores" : "",
  ].filter(Boolean).length;
  const completion = Math.round((completedFields / 10) * 100);

  function updateAddress(update: Partial<NonNullable<UserAccount["address"]>>) {
    onDraftChange({ address: { ...address, ...update } });
  }

  function togglePermission(permission: PermissionKey) {
    onDraftChange({
      permissions: activePermissions.includes(permission)
        ? activePermissions.filter((item) => item !== permission)
        : [...activePermissions, permission],
    });
  }

  function toggleSector(sectorId: string) {
    onDraftChange({
      sectorIds: activeSectorIds.includes(sectorId)
        ? activeSectorIds.filter((item) => item !== sectorId)
        : [...activeSectorIds, sectorId],
    });
  }

  return (
    <div className="user-drawer-backdrop" role="dialog" aria-modal="true" aria-label={`Detalhes de ${user.name}`}>
      <button className="user-drawer-scrim" type="button" aria-label="Fechar edicao" onClick={onClose} />
      <aside className="user-drawer">
        <header className="user-drawer-header">
          <div>
            <span>Usuarios / Detalhes do Usuario</span>
            <h2>{draft.name || user.name}</h2>
          </div>
          <div className="drawer-actions">
            <span className={`user-status ${normalizeText(String(draft.status ?? user.status))}`}>
              {draft.status ?? user.status}
            </span>
            <button className="primary-button compact" type="button" onClick={onSave}>
              <Save size={16} />
              Salvar
            </button>
            <button className="icon-button" type="button" aria-label="Fechar" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {!draft.profileComplete ? (
          <div className="profile-completion-banner">
            <CheckCircle2 size={18} />
            <div>
              <strong>Cadastro em andamento</strong>
              <span>Complete dados pessoais, endereco, setores e permissoes. Progresso atual: {completion}%.</span>
            </div>
          </div>
        ) : null}

        <div className="user-drawer-shell">
          <aside className="user-drawer-profile">
            <div
              className="drawer-avatar"
              style={draft.avatarUrl ? { backgroundImage: `url(${draft.avatarUrl})` } : undefined}
              aria-hidden="true"
            >
              {!draft.avatarUrl ? String(draft.name ?? user.name).slice(0, 2).toUpperCase() : null}
            </div>
            <h3>{draft.name ?? user.name}</h3>
            <span className="drawer-role">{draft.type === "CLIENT" ? "Cliente" : draft.type === "ADMIN" ? "Admin" : "Operador"}</span>
            <label className="upload-field compact-upload">
              <Upload size={15} />
              <span>Enviar foto</span>
              <input
                accept="image/*"
                type="file"
                onChange={async (event) => {
                  const input = event.currentTarget;
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const uploaded = await safeUploadFile(onUploadFile, file, "users");
                  if (!uploaded) {
                    input.value = "";
                    return;
                  }
                  onDraftChange({ avatarUrl: uploaded.url });
                  input.value = "";
                }}
              />
            </label>
            <div className="settings-list compact drawer-contact-list">
              <SettingsLine icon={Mail} label="E-mail" value={String(draft.email ?? user.email)} />
              <SettingsLine icon={Phone} label="Telefone" value={String(draft.phone || "Nao informado")} />
              <SettingsLine icon={Building2} label="Cargo" value={String(draft.jobTitle || draft.role || "Nao informado")} />
              <SettingsLine icon={Clock3} label="Atualizado" value={String(draft.updatedAt || user.updatedAt || "sem data")} />
            </div>
            <div className="drawer-mini-card">
              <strong>Informacoes rapidas</strong>
              <span>Setores: {sectorNames || "sem setores"}</span>
              <span>Criado em: {draft.createdAt || user.createdAt || "sem data"}</span>
              <span>Perfil: {draft.role ?? user.role}</span>
            </div>
            <div className="drawer-mini-card">
              <strong>Permissao de acesso</strong>
              {permissionOptions.slice(0, 6).map((permission) => (
                <label className="drawer-checkline" key={permission.key}>
                  <input checked={activePermissions.includes(permission.key)} readOnly type="checkbox" />
                  {permission.label}
                </label>
              ))}
            </div>
          </aside>

          <div className="user-drawer-content">
            <nav className="user-drawer-tabs" aria-label="Secoes do usuario">
              {["Dados Gerais", "Endereco", "Producao", "Financeiro", "Permissoes", "Historico"].map((tab) => (
                <span key={tab}>{tab}</span>
              ))}
            </nav>

            <div className="user-detail-grid">
              <section className="user-detail-card">
                <h3><UserCog size={16} /> Dados pessoais</h3>
                <div className="field-grid two">
                  <TextField label="Nome completo" value={String(draft.name ?? "")} onChange={(name) => onDraftChange({ name })} />
                  <TextField label="Documento" value={String(draft.document ?? "")} onChange={(document) => onDraftChange({ document })} />
                  <TextField label="Data de nascimento" type="date" value={String(draft.birthDate ?? "")} onChange={(birthDate) => onDraftChange({ birthDate })} />
                  <label>
                    Status
                    <select
                      value={draft.status ?? user.status}
                      onChange={(event) => onDraftChange({ status: event.target.value as UserAccount["status"] })}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Convidado">Convidado</option>
                      <option value="Suspenso">Suspenso</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="user-detail-card">
                <h3><Phone size={16} /> Contato</h3>
                <div className="field-grid two">
                  <TextField label="E-mail corporativo" type="email" value={String(draft.email ?? "")} onChange={(email) => onDraftChange({ email })} />
                  <TextField label="E-mail pessoal" type="email" value={String(draft.personalEmail ?? "")} onChange={(personalEmail) => onDraftChange({ personalEmail })} />
                  <TextField label="Telefone principal" value={String(draft.phone ?? "")} onChange={(phone) => onDraftChange({ phone })} />
                  <TextField label="WhatsApp" value={String(draft.whatsapp ?? "")} onChange={(whatsapp) => onDraftChange({ whatsapp })} />
                </div>
              </section>

              <section className="user-detail-card wide">
                <h3><Home size={16} /> Endereco</h3>
                <div className="field-grid four">
                  <TextField label="CEP" value={String(address.zip ?? "")} onChange={(zip) => updateAddress({ zip })} />
                  <TextField label="Rua" value={String(address.street ?? "")} onChange={(street) => updateAddress({ street })} />
                  <TextField label="Numero" value={String(address.number ?? "")} onChange={(number) => updateAddress({ number })} />
                  <TextField label="Complemento" value={String(address.complement ?? "")} onChange={(complement) => updateAddress({ complement })} />
                  <TextField label="Bairro" value={String(address.district ?? "")} onChange={(district) => updateAddress({ district })} />
                  <TextField label="Cidade" value={String(address.city ?? "")} onChange={(city) => updateAddress({ city })} />
                  <TextField label="Estado" value={String(address.state ?? "")} onChange={(state) => updateAddress({ state: state.toUpperCase() })} />
                  <TextField label="Pais" value={String(address.country ?? "BR")} onChange={(country) => updateAddress({ country })} />
                </div>
              </section>

              <section className="user-detail-card">
                <h3><Factory size={16} /> Dados corporativos</h3>
                <div className="field-grid two">
                  <label>
                    Tipo de usuario
                    <select
                      value={draft.type ?? user.type}
                      onChange={(event) => onDraftChange({ type: event.target.value as UserAccount["type"] })}
                    >
                      <option value="OPERATOR">Operador</option>
                      <option value="CLIENT">Cliente</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>
                  <label>
                    Perfil de acesso
                    <select
                      value={draft.role ?? user.role}
                      onChange={(event) => onDraftChange({ role: event.target.value as UserAccount["role"] })}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Gerente</option>
                      <option value="OPERATOR">Operador</option>
                      <option value="FINANCE">Financeiro</option>
                      <option value="CLIENT">Cliente</option>
                      <option value="VIEWER">Leitura</option>
                    </select>
                  </label>
                  <TextField label="Cargo" value={String(draft.jobTitle ?? "")} onChange={(jobTitle) => onDraftChange({ jobTitle })} />
                  <TextField label="Departamento" value={String(draft.department ?? "")} onChange={(department) => onDraftChange({ department })} />
                  <TextField label="Data de admissao" type="date" value={String(draft.admissionDate ?? "")} onChange={(admissionDate) => onDraftChange({ admissionDate })} />
                  <TextField label="Supervisor" value={String(draft.supervisor ?? "")} onChange={(supervisor) => onDraftChange({ supervisor })} />
                  <TextField label="Turno" value={String(draft.shift ?? "")} onChange={(shift) => onDraftChange({ shift })} />
                </div>
              </section>

              <section className="user-detail-card">
                <h3><Layers3 size={16} /> Setores acessiveis</h3>
                <div className="permission-chip-grid separated">
                  {sectors.map((sector) => {
                    const active = activeSectorIds.includes(sector.id);
                    return (
                      <button
                        className={`permission-chip sector ${active ? "active" : ""}`}
                        type="button"
                        key={sector.id}
                        onClick={() => toggleSector(sector.id)}
                      >
                        {active ? <Check size={14} /> : <Layers3 size={14} />}
                        {sector.name}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="user-detail-card">
                <h3><DollarSign size={16} /> Dados financeiros</h3>
                <div className="field-grid two">
                  <TextField label="Centro de custo" value={String(draft.costCenter ?? "")} onChange={(costCenter) => onDraftChange({ costCenter })} />
                  <TextField label="Banco" value={String(draft.bank ?? "")} onChange={(bank) => onDraftChange({ bank })} />
                  <TextField label="Conta" value={String(draft.bankAccount ?? "")} onChange={(bankAccount) => onDraftChange({ bankAccount })} />
                  <TextField label="Chave Pix" value={String(draft.pixKey ?? "")} onChange={(pixKey) => onDraftChange({ pixKey })} />
                </div>
              </section>

              <section className="user-detail-card wide">
                <h3><ShieldCheck size={16} /> Permissoes do sistema</h3>
                <div className="permission-chip-grid separated">
                  {permissionOptions.map((permission) => {
                    const active = activePermissions.includes(permission.key);
                    return (
                      <button
                        className={`permission-chip ${active ? "active" : ""}`}
                        type="button"
                        key={permission.key}
                        onClick={() => togglePermission(permission.key)}
                      >
                        {active ? <Check size={14} /> : <Plus size={14} />}
                        {permission.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="user-detail-card">
                <h3><LockKeyhole size={16} /> Seguranca</h3>
                <form
                  className="user-password-form drawer-password-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onPasswordSubmit();
                  }}
                >
                  <input
                    value={passwordDraft}
                    minLength={8}
                    placeholder="Nova senha temporaria"
                    type="password"
                    onChange={(event) => onPasswordDraftChange(event.target.value)}
                  />
                  <button className="ghost-button compact" type="submit">
                    <LockKeyhole size={16} />
                    Trocar senha
                  </button>
                </form>
                <label className="drawer-checkline profile-checkline">
                  <input
                    checked={Boolean(draft.profileComplete)}
                    type="checkbox"
                    onChange={(event) => onDraftChange({ profileComplete: event.target.checked })}
                  />
                  Perfil completo
                </label>
              </section>

              <section className="user-detail-card">
                <h3><Clock3 size={16} /> Historico</h3>
                <div className="history-list">
                  <span>Usuario criado em {draft.createdAt || user.createdAt || "sem data"}</span>
                  <span>Ultima atualizacao em {draft.updatedAt || user.updatedAt || "sem data"}</span>
                  <span>Setores vinculados: {sectorNames || "nenhum"}</span>
                </div>
              </section>

              <section className="user-detail-card wide">
                <h3><FileText size={16} /> Observacoes</h3>
                <textarea
                  value={String(draft.notes ?? "")}
                  placeholder="Observacoes internas, treinamentos, restricoes e informacoes importantes..."
                  onChange={(event) => onDraftChange({ notes: event.target.value })}
                />
              </section>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProductsView({
  products,
  onCreateProduct,
  onEditProduct,
  onDeleteProduct,
}: {
  products: Product[];
  onCreateProduct: () => void;
  onEditProduct: (productId: string) => void;
  onDeleteProduct: (productId: string) => void | Promise<void>;
}) {
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");
  const productCategories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const filteredProducts = products.filter((product) => {
    if (!productMatchesQuery(product, productSearch)) return false;
    if (categoryFilter !== "all" && product.category !== categoryFilter) return false;
    const isAvailable = product.active && !product.saleBlocked;
    if (availabilityFilter === "available" && !isAvailable) return false;
    if (availabilityFilter === "unavailable" && isAvailable) return false;
    return true;
  });
  const averagePrice = products.length
    ? products.reduce((sum, product) => sum + product.price, 0) / products.length
    : 0;
  const totalStock = products.reduce((sum, product) => sum + (product.stockQty ?? 0), 0);
  const categoryCount = new Set(products.map((product) => product.category).filter(Boolean)).size;
  const productCountLabel = `${formatNumber(products.length)} ${products.length === 1 ? "produto" : "produtos"}`;
  const filteredProductNoun = filteredProducts.length === 1 ? "produto" : "produtos";

  return (
    <section className="table-card products-reference-page">
      <div className="products-reference-header">
        <span className="products-reference-icon">
          <Package size={34} />
        </span>
        <div>
          <strong>{productCountLabel}</strong>
          <span>Catálogo operacional da gráfica</span>
        </div>
        <button className="primary-button" type="button" onClick={onCreateProduct}>
          <Plus size={18} />
          Novo Produto
        </button>
      </div>

      <div className="products-summary-grid">
        <OrderMetricCard
          icon={Package}
          title="Total de produtos"
          value={formatNumber(products.length)}
          detail="cadastrados"
          tone="#6b45ff"
        />
        <OrderMetricCard
          icon={Tag}
          title="Valor médio"
          value={formatCurrency(averagePrice)}
          detail="por produto"
          tone="#18a957"
        />
        <OrderMetricCard
          icon={Layers3}
          title="Estoque total"
          value={formatNumber(totalStock)}
          detail="unidades"
          tone="#236dff"
        />
        <OrderMetricCard
          icon={ChartNoAxesColumn}
          title="Categorias"
          value={formatNumber(categoryCount)}
          detail="ativas"
          tone="#ff7208"
        />
      </div>

      <section className="products-table-card">
        <div className="products-table-toolbar">
          <label className="products-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Buscar produto..."
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
          </label>

          <div className="orders-toolbar-actions">
            <label className="filter-select-control">
              <Funnel size={17} />
              <span className="sr-only">Filtrar categoria</span>
              <select
                aria-label="Filtrar categoria"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">Todas as categorias</option>
                {productCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
            <label className="filter-select-control">
              <Package size={17} />
              <span className="sr-only">Filtrar disponibilidade</span>
              <select
                aria-label="Filtrar disponibilidade"
                value={availabilityFilter}
                onChange={(event) => setAvailabilityFilter(event.target.value as "all" | "available" | "unavailable")}
              >
                <option value="all">Todos</option>
                <option value="available">Disponíveis</option>
                <option value="unavailable">Indisponíveis</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <button className="ghost-button" type="button">
              <Download size={17} />
              Exportar
            </button>
          </div>
        </div>

        <div className="products-table-scroll w-full overflow-x-auto">
          <table className="products-table">
            <thead>
              <tr>
                <th>
                  <span className="sortable-heading">
                    Produto
                    <ChevronDown size={13} />
                  </span>
                </th>
                <th>Categoria</th>
                <th>Setor</th>
                <th>Preço</th>
                <th>Mínimo</th>
                <th>Fração</th>
                <th>Estoque</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const productPhoto = product.thumbnailUrl || quoteProductImage(product);
                const stockLabel = product.stockItem || product.name;
                const isAvailable = product.active && !product.saleBlocked;

                return (
                  <tr key={product.id}>
                    <td>
                      <div className="product-name-cell">
                        <span
                          className="product-table-thumb"
                          style={{ backgroundImage: `url(${productPhoto})` }}
                          aria-hidden="true"
                        />
                        <div>
                          <strong>{product.name}</strong>
                          <small>Código interno: {product.sku ?? product.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="product-chip category"
                        style={{ "--chip-tone": visualColor(product.category) } as CSSProperties}
                      >
                        {product.category}
                      </span>
                    </td>
                    <td>
                      <span className="product-chip sector">{product.sector || "Sem setor"}</span>
                    </td>
                    <td>{formatCurrency(product.price)}</td>
                    <td>{formatNumber(product.minOrderQty)}</td>
                    <td className={product.allowsFractions ? "product-fraction-yes" : undefined}>
                      {product.allowsFractions ? `${formatNumber(product.minFractionQty)}+` : "Não"}
                    </td>
                    <td>
                      <div className={isAvailable ? "product-stock-cell" : "product-stock-cell unavailable"}>
                        <span>{stockLabel}</span>
                        <small>
                          <i aria-hidden="true" />
                          {isAvailable ? "Disponível" : "Indisponível"}
                        </small>
                      </div>
                    </td>
                    <td>
                      <div className="row-actions product-row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Editar ${product.name}`}
                          title="Editar produto"
                          onClick={() => onEditProduct(product.id)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button danger-action"
                          type="button"
                          aria-label={`Remover ${product.name}`}
                          title="Remover produto"
                          onClick={() => void onDeleteProduct(product.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          className="icon-button ghost-dots"
                          type="button"
                          aria-label={`Mais ações de ${product.name}`}
                          title="Mais ações"
                        >
                          <MoreVertical size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="orders-pagination">
          <span>
            Mostrando {filteredProducts.length ? 1 : 0} a {filteredProducts.length} de {filteredProducts.length} {filteredProductNoun}
          </span>
          <div>
            <button className="icon-button" type="button" aria-label="Página anterior" disabled>
              <ChevronLeft size={17} />
            </button>
            <button className="orders-page-number" type="button">1</button>
            <button className="icon-button" type="button" aria-label="Próxima página" disabled>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
function CatalogView({
  products,
  onSelectProduct,
  onManageCategories,
}: {
  products: Product[];
  onSelectProduct: (productId: string) => void;
  onManageCategories: () => void;
}) {
  const activeProducts = products.filter((product) => product.active && !product.saleBlocked);
  const averagePrice = activeProducts.length
    ? activeProducts.reduce((sum, product) => sum + product.price, 0) / activeProducts.length
    : 0;
  const categoryCount = new Set(products.map((product) => product.category).filter(Boolean)).size;
  const totalStock = products.reduce((sum, product) => sum + (product.stockQty ?? 0), 0);

  return (
    <section className="catalog-reference-page">
      <div className="catalog-summary-band">
        <CatalogMetric
          icon={Package}
          label="Total de produtos"
          value={formatNumber(activeProducts.length)}
          detail="Ativos no catálogo"
          tone="#6b45ff"
        />
        <CatalogMetric
          icon={Tag}
          label="Preço médio"
          value={formatCurrency(averagePrice)}
          detail="Entre todos os produtos"
          tone="#18a957"
        />
        <CatalogMetric
          icon={Package}
          label="Categorias"
          value={formatNumber(categoryCount)}
          detail="Categorizadas"
          tone="#ff7208"
        />
        <CatalogMetric
          icon={Layers3}
          label="Estoque total"
          value={formatNumber(totalStock)}
          detail="Unidades disponíveis"
          tone="#236dff"
        />
      </div>

      <div className="catalog-product-grid">
        {products.map((product) => {
          const productPhoto = product.thumbnailUrl || quoteProductImage(product);
          const stockQuantity = product.stockQty ?? product.minFractionQty ?? product.minOrderQty;
          const lowStockThreshold = Math.max(product.stockMin ?? 0, product.minOrderQty ?? 0);
          const isLowStock = product.active && !product.saleBlocked && stockQuantity <= lowStockThreshold;
          const isAvailable = product.active && !product.saleBlocked && stockQuantity > 0;
          const stockBadgeClass = isLowStock
            ? "catalog-stock-badge low"
            : isAvailable
              ? "catalog-stock-badge"
              : "catalog-stock-badge unavailable";
          const stockText = product.allowsFractions
            ? `${formatNumber(product.minFractionQty)}+ un`
            : `${formatNumber(stockQuantity)} un`;

          return (
            <article className="catalog-product-card" key={product.id}>
              <div
                className="catalog-product-image"
                style={{ backgroundImage: `url(${productPhoto})` }}
              >
                <span className={stockBadgeClass}>
                  {isLowStock ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  {isLowStock ? "Estoque baixo" : isAvailable ? "Em estoque" : "Indisponível"}
                </span>
              </div>

              <h3>{product.name}</h3>
              <p>{product.category} · {product.sector || "Sem setor"}</p>

              <div className="catalog-product-metrics">
                <span>
                  <i className="purple">
                    <Package size={18} />
                  </i>
                  <small>Preço</small>
                  <strong>{formatCurrency(product.price)}</strong>
                </span>
                <span>
                  <i className={isLowStock ? "orange" : "blue"}>
                    <Layers3 size={18} />
                  </i>
                  <small>Estoque</small>
                  <strong>{stockText}</strong>
                </span>
              </div>

              <button className="primary-button wide" type="button" onClick={() => onSelectProduct(product.id)}>
                <ShoppingBag size={18} />
                Montar Pedido
              </button>
            </article>
          );
        })}
      </div>

      <div className="catalog-tip">
        <span>
          <Lightbulb size={30} />
        </span>
        <div>
          <strong>Dica</strong>
          <p>Mantenha seu catálogo atualizado para facilitar e agilizar a montagem dos pedidos.</p>
        </div>
        <button className="ghost-button" type="button" onClick={onManageCategories}>
          <LayoutGrid size={18} />
          Gerenciar categorias
        </button>
      </div>
    </section>
  );
}

function CatalogMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className="catalog-summary-item" style={{ "--catalog-tone": tone } as CSSProperties}>
      <span>
        <Icon size={28} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </article>
  );
}
function InventoryView({
  inventory,
  onUploadFile,
  onRestock,
  onUpdateItem,
  onDeleteItem,
}: {
  inventory: InventoryItem[];
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onRestock: (itemId: string, quantity: number) => void | Promise<void>;
  onUpdateItem: (itemId: string, update: InventoryDraft) => void | Promise<void>;
  onDeleteItem: (itemId: string) => void | Promise<void>;
}) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [restockingItemId, setRestockingItemId] = useState<string | null>(null);
  const [restockQuantities, setRestockQuantities] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, InventoryDraft>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const filteredInventory = inventory.filter((item) => {
    const haystack = `${item.name} ${item.category} ${item.unit} ${item.lastMove}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const pageCount = Math.max(1, Math.ceil(filteredInventory.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedInventory = filteredInventory.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function itemDraft(item: InventoryItem): InventoryDraft {
    return drafts[item.id] ?? {
      name: item.name,
      category: item.category,
      imageUrl: item.imageUrl ?? "",
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      unit: item.unit,
      lastMove: item.lastMove,
    };
  }

  function updateDraft(item: InventoryItem, update: Partial<InventoryDraft>) {
    setDrafts((current) => ({ ...current, [item.id]: { ...itemDraft(item), ...update } }));
  }

  function restockQuantity(item: InventoryItem) {
    return restockQuantities[item.id] ?? Math.max(item.minQuantity, 1);
  }

  function openRestock(item: InventoryItem) {
    setRestockingItemId((current) => (current === item.id ? null : item.id));
    setRestockQuantities((current) => ({ ...current, [item.id]: restockQuantity(item) }));
  }

  return (
    <section className="table-card">
      <div className="table-toolbar">
        <div>
          <strong>{inventory.length} itens</strong>
          <span>Busca, imagem, mínimos e movimentações de estoque</span>
        </div>
        <label className="toolbar-search">
          <Search size={16} />
          <input
            type="search"
            value={search}
            placeholder="Buscar item, categoria ou unidade"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <div className="entity-list inventory-list">
      {paginatedInventory.map((item) => {
        const low = item.quantity < item.minQuantity;
        const percent = Math.min(100, Math.round((item.quantity / Math.max(item.minQuantity * 2, 1)) * 100));
        const editing = editingItemId === item.id;
        const restocking = restockingItemId === item.id;
        const draft = itemDraft(item);

        return (
          <article className={`entity-row inventory-row ${low ? "attention" : ""}`} key={item.id}>
            <div className="card-head">
              <span>{item.category}</span>
              {low ? <DangerTag label="Baixo" /> : <SuccessTag label="OK" />}
            </div>
            <div className="inventory-thumb" style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined} aria-hidden="true">
              {!item.imageUrl ? <Boxes size={20} /> : null}
            </div>
            <div className="entity-copy">
              <div className="entity-line primary">
                <div>
                  <h3>{item.name}</h3>
                  <span>{item.category}</span>
                </div>
                {low ? <DangerTag label="Baixo" /> : <SuccessTag label="OK" />}
              </div>
              <div className="entity-line secondary">
                <span><Boxes size={14} /> {formatNumber(item.quantity)} {item.unit}</span>
                <span><AlertTriangle size={14} /> Minimo {formatNumber(item.minQuantity)} {item.unit}</span>
                <span><Clock3 size={14} /> {item.lastMove}</span>
              </div>
              <ProgressBar value={percent} color={low ? "#ee3045" : "#16b981"} />
            </div>
            <h3>{item.name}</h3>
            <p>Última movimentação: {item.lastMove}</p>
            <div className="stock-number">
              <strong>{formatNumber(item.quantity)}</strong>
              <span>{item.unit}</span>
            </div>
            <ProgressBar value={percent} color={low ? "#ee3045" : "#16b981"} />
            <small>Mínimo: {formatNumber(item.minQuantity)} {item.unit}</small>
            {editing ? (
              <form
                className="inline-edit-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onUpdateItem(item.id, draft);
                  setEditingItemId(null);
                }}
              >
                <input value={draft.name} onChange={(event) => updateDraft(item, { name: event.target.value })} />
                <input value={draft.category} onChange={(event) => updateDraft(item, { category: event.target.value })} />
                <label className="upload-field inline-upload">
                  <Upload size={15} />
                  <span>{draft.imageUrl ? "Imagem enviada" : "Enviar imagem"}</span>
                  <input
                    accept="image/*"
                    type="file"
                    onChange={async (event) => {
                      const input = event.currentTarget;
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const uploaded = await safeUploadFile(onUploadFile, file, "inventory");
                      if (!uploaded) {
                        input.value = "";
                        return;
                      }
                      updateDraft(item, { imageUrl: uploaded.url });
                      input.value = "";
                    }}
                  />
                </label>
                <input type="number" value={draft.quantity} onChange={(event) => updateDraft(item, { quantity: Number(event.target.value) })} />
                <input type="number" value={draft.minQuantity} onChange={(event) => updateDraft(item, { minQuantity: Number(event.target.value) })} />
                <input value={draft.unit} onChange={(event) => updateDraft(item, { unit: event.target.value })} />
                <button className="primary-button compact" type="submit">
                  <Save size={15} />
                  Salvar
                </button>
              </form>
            ) : null}
            <div className="entity-actions">
              <button className="icon-button" type="button" title="Repor" onClick={() => openRestock(item)}>
                <Boxes size={16} />
              </button>
              <button className="icon-button" type="button" title="Editar" onClick={() => setEditingItemId(editing ? null : item.id)}>
                <Pencil size={16} />
              </button>
              <button className="icon-button danger-action" type="button" title="Excluir" onClick={() => void onDeleteItem(item.id)}>
                <Trash2 size={16} />
              </button>
            </div>
            {restocking ? (
              <form
                className="restock-panel"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const quantity = Math.max(1, Number(restockQuantities[item.id] ?? 0));
                  await onRestock(item.id, quantity);
                  setRestockingItemId(null);
                }}
              >
                <label>
                  Quantidade para reposicao
                  <input
                    min={1}
                    step="any"
                    type="number"
                    value={restockQuantity(item)}
                    onChange={(event) =>
                      setRestockQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                    }
                  />
                </label>
                <span>
                  Atual: {formatNumber(item.quantity)} {item.unit}
                </span>
                <button className="primary-button compact" type="submit">
                  <Save size={15} />
                  Confirmar
                </button>
                <button className="ghost-button compact" type="button" onClick={() => setRestockingItemId(null)}>
                  <X size={15} />
                  Cancelar
                </button>
              </form>
            ) : null}
          </article>
        );
      })}
      {!paginatedInventory.length ? (
        <div className="empty-state">
          <Warehouse size={20} />
          Nenhum item encontrado.
        </div>
      ) : null}
      </div>
      <div className="pagination-row">
        <span>
          Pagina {currentPage} de {pageCount} · {filteredInventory.length} itens
        </span>
        <div>
          <button className="ghost-button compact" type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Anterior
          </button>
          <button className="ghost-button compact" type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
            Proxima
          </button>
        </div>
      </div>
    </section>
  );
}

function estimatedOrderHours(order: Order) {
  const sector = normalizeText(order.sector);
  const sectorFactor = sector.includes("gravacao")
    ? 0.035
    : sector.includes("sublimacao")
      ? 0.045
      : sector.includes("acabamento")
        ? 0.028
        : sector.includes("impressao")
          ? 0.04
          : 0.03;
  const priorityFactor = order.priority === "Crítica" ? 1.25 : order.priority === "Alta" ? 1.12 : 1;

  return Math.max(1, Math.round(order.quantity * sectorFactor * priorityFactor));
}

function machineHourMetrics(machine: Machine, orders: Order[]) {
  const relatedOrders = orders.filter((order) => order.sector === machine.sector);
  const openOrders = relatedOrders.filter((order) => !isClosedOrderStatus(order.status));
  const closedOrders = relatedOrders.filter((order) => isDeliveredOrderStatus(order.status));
  const openHours = openOrders.reduce(
    (sum, order) => sum + Math.max(1, Math.round(estimatedOrderHours(order) * (order.progress / 100))),
    0,
  );
  const closedHours = closedOrders.reduce((sum, order) => sum + estimatedOrderHours(order), 0);

  return {
    openOrders: openOrders.length,
    closedOrders: closedOrders.length,
    openHours,
    closedHours,
    totalHours: openHours + closedHours,
  };
}

function sameProductionSector(left: string | undefined, right: string | undefined) {
  return normalizeText(left ?? "").trim() === normalizeText(right ?? "").trim();
}

function clampedPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function sectorLiveMetrics(sector: Sector, orders: Order[], machines: Machine[], products: Product[]) {
  const sectorOrders = orders.filter(
    (order) => order.stageId === sector.id || sameProductionSector(order.sector, sector.name),
  );
  const activeOrders = sectorOrders.filter((order) => !isClosedOrderStatus(order.status));
  const deliveredOrders = sectorOrders.filter((order) => isDeliveredOrderStatus(order.status)).length;
  const sectorMachines = machines.filter((machine) => sameProductionSector(machine.sector, sector.name));
  const linkedProducts = products.filter((product) => sameProductionSector(product.sector, sector.name));
  const machineCapacity = sectorMachines.length
    ? clampedPercent(
        sectorMachines.reduce((total, machine) => total + clampedPercent(machine.utilization), 0) /
          sectorMachines.length,
      )
    : undefined;

  return {
    activeOrders,
    deliveredOrders,
    linkedProducts,
    machineCount: sectorMachines.length,
    capacity: machineCapacity ?? clampedPercent(sector.capacity),
  };
}

function MachinesView({
  machines,
  orders,
  sectors,
  onOpenMaintenance,
  onUpdateMachine,
  onDeleteMachine,
}: {
  machines: Machine[];
  orders: Order[];
  sectors: Sector[];
  onOpenMaintenance: (machineId: string) => void;
  onUpdateMachine: (
    machineId: string,
    update: Partial<Pick<Machine, "name" | "sector" | "status" | "utilization" | "nextMaintenance" | "costMonth">>,
  ) => void;
  onDeleteMachine: (machineId: string) => void;
}) {
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  function saveMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingMachine) {
      return;
    }

    onUpdateMachine(editingMachine.id, {
      name: editingMachine.name,
      sector: editingMachine.sector,
      status: editingMachine.status,
      utilization: editingMachine.utilization,
      nextMaintenance: editingMachine.nextMaintenance,
      costMonth: editingMachine.costMonth,
    });
    setEditingMachine(null);
  }

  return (
    <section className="board-grid machine-grid">
      {machines.map((machine) => {
        const metrics = machineHourMetrics(machine, orders);
        const isEditing = editingMachine?.id === machine.id;

        return (
          <article className="operation-card machine-card" key={machine.id}>
            <div className="card-head">
              <span>{machine.sector}</span>
              <MachineStatus status={machine.status} />
            </div>

            {isEditing && editingMachine ? (
              <form className="machine-edit-form" onSubmit={saveMachine}>
                <label>
                  Nome
                  <input
                    value={editingMachine.name}
                    onChange={(event) =>
                      setEditingMachine({ ...editingMachine, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Setor
                  <select
                    value={editingMachine.sector}
                    onChange={(event) =>
                      setEditingMachine({ ...editingMachine, sector: event.target.value })
                    }
                  >
                    {sectors.map((sector) => (
                      <option value={sector.name} key={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={editingMachine.status}
                    onChange={(event) =>
                      setEditingMachine({
                        ...editingMachine,
                        status: event.target.value as Machine["status"],
                      })
                    }
                  >
                    <option value="Operando">Operando</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Ociosa">Ociosa</option>
                  </select>
                </label>
                <label>
                  Uso (%)
                  <input
                    min={0}
                    max={100}
                    type="number"
                    value={editingMachine.utilization}
                    onChange={(event) =>
                      setEditingMachine({
                        ...editingMachine,
                        utilization: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Próxima manutenção
                  <input
                    value={editingMachine.nextMaintenance}
                    onChange={(event) =>
                      setEditingMachine({
                        ...editingMachine,
                        nextMaintenance: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Custo mensal
                  <input
                    min={0}
                    step="any"
                    type="number"
                    value={editingMachine.costMonth}
                    onChange={(event) =>
                      setEditingMachine({
                        ...editingMachine,
                        costMonth: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <div className="inline-actions">
                  <button className="primary-button compact" type="submit">
                    <Save size={16} />
                    Salvar
                  </button>
                  <button className="ghost-button compact" type="button" onClick={() => setEditingMachine(null)}>
                    <X size={16} />
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h3>{machine.name}</h3>
                <p>Próxima manutenção: {machine.nextMaintenance}</p>
                <ProgressBar value={machine.utilization} color={machine.status === "Manutenção" ? "#ff7a00" : "#5b45ff"} />

                <div className="machine-hours">
                  <span>
                    <Cpu size={16} />
                    <strong>{metrics.totalHours}h</strong>
                    funcionamento
                  </span>
                  <span>
                    <Clock3 size={16} />
                    <strong>{metrics.openHours}h</strong>
                    pedidos abertos
                  </span>
                  <span>
                    <Check size={16} />
                    <strong>{metrics.closedHours}h</strong>
                    pedidos fechados
                  </span>
                </div>

                <div className="metric-strip">
                  <span>
                    <strong>{metrics.openOrders}</strong>
                    abertos
                  </span>
                  <span>
                    <strong>{metrics.closedOrders}</strong>
                    fechados
                  </span>
                  <span>
                    <strong>{machine.utilization}%</strong>
                    utilização
                  </span>
                  <span>
                    <strong>{formatCurrency(machine.costMonth)}</strong>
                    custo mensal
                  </span>
                </div>

                <div className="machine-actions">
                  <button className="ghost-button compact" type="button" onClick={() => onOpenMaintenance(machine.id)}>
                    <Wrench size={16} />
                    Abrir chamado
                  </button>
                  <button className="ghost-button compact" type="button" onClick={() => setEditingMachine(machine)}>
                    <Pencil size={16} />
                    Editar
                  </button>
                  <button
                    className="ghost-button compact danger-action"
                    type="button"
                    disabled={machines.length <= 1}
                    onClick={() => onDeleteMachine(machine.id)}
                  >
                    <Trash2 size={16} />
                    Deletar
                  </button>
                </div>
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}

function SectorUsersPanel({
  sector,
  users,
  canManage,
  onAddUser,
  onRemoveUser,
}: {
  sector: Sector;
  users: UserAccount[];
  canManage: boolean;
  onAddUser: (userId: string) => Promise<void>;
  onRemoveUser: (userId: string) => Promise<void>;
}) {
  const linked = users.filter((u) => u.sectorIds.includes(sector.id));
  const available = users.filter((u) => !u.sectorIds.includes(sector.id) && u.type !== "CLIENT");
  const [selectedId, setSelectedId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleAdd() {
    const id = selectedId || available[0]?.id;
    if (!id) return;
    setAdding(true);
    try {
      await onAddUser(id);
      setSelectedId("");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId: string) {
    setRemoving(userId);
    try {
      await onRemoveUser(userId);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div style={{
      border: "1px solid var(--line)",
      borderRadius: 8,
      padding: "8px 10px",
      marginTop: 10,
      background: "var(--panel-2)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <Users size={11} color="var(--primary)" />
        <span style={{ fontSize: 10, fontWeight: 650, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Usuários vinculados
        </span>
      </div>

      {linked.length === 0 ? (
        <p style={{ fontSize: 11, color: "var(--muted-2)", margin: "0 0 6px" }}>Nenhum usuário vinculado.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {linked.map((user) => (
            <span
              key={user.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--primary)",
                background: "color-mix(in srgb, var(--primary) 8%, var(--panel))",
                lineHeight: 1.4,
              }}
            >
              <button
                type="button"
                title={`Remover ${user.name}`}
                disabled={removing === user.id}
                onClick={() => handleRemove(user.id)}
                aria-label={`Remover ${user.name}`}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: removing === user.id ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: removing === user.id ? "var(--line)" : "var(--muted)",
                  lineHeight: 1,
                }}
              >
                <X size={10} />
              </button>
              {user.name.split(" ")[0]}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <select
          aria-label={`Vincular usuário ao setor ${sector.name}`}
          value={selectedId || available[0]?.id || ""}
          disabled={adding || available.length === 0}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{
            flex: 1,
            fontSize: 11,
            padding: "3px 5px",
            border: "1px solid var(--line)",
            borderRadius: 4,
            background: "var(--panel)",
            color: "var(--foreground)",
          }}
        >
          {available.length ? (
            available.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))
          ) : (
            <option value="">Todos já vinculados</option>
          )}
        </select>
        <button
          type="button"
          disabled={adding || available.length === 0}
          onClick={handleAdd}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            border: "1px solid var(--line)",
            borderRadius: 4,
            background: adding || available.length === 0
              ? "var(--panel-2)"
              : "color-mix(in srgb, var(--primary) 10%, var(--panel))",
            color: adding || available.length === 0 ? "var(--muted-2)" : "var(--primary)",
            cursor: adding || available.length === 0 ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <UserPlus size={11} />
          {adding ? "…" : "Vincular"}
        </button>
      </div>
    </div>
  );
}

function SectorsView({
  sectors,
  orders,
  machines,
  users,
  canManageUsers,
  onViewChange,
  onUpdateSector,
  onDeleteSector,
  onAddUserToSector,
  onRemoveUserFromSector,
  onSetSectorOrder,
}: {
  sectors: Sector[];
  orders: Order[];
  machines: Machine[];
  users: UserAccount[];
  canManageUsers: boolean;
  onViewChange: (view: ViewKey) => void;
  onUpdateSector: (
    sectorId: string,
    update: Partial<Pick<Sector, "name" | "capacity" | "sla" | "lead">>,
  ) => void;
  onDeleteSector: (sectorId: string) => void;
  onAddUserToSector: (userId: string, sectorId: string) => Promise<void>;
  onRemoveUserFromSector: (userId: string, sectorId: string) => Promise<void>;
  onSetSectorOrder: (sectorId: string, newPosition: number) => void;
}) {
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const sectorTones = ["#6b45ff", "#315dff", "#149954", "#ff7308"];
  const sectorIcons = [ShoppingBag, Wrench, Settings, ClipboardList];

  function saveSector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingSector) {
      return;
    }

    onUpdateSector(editingSector.id, {
      name: editingSector.name,
      capacity: editingSector.capacity,
      sla: editingSector.sla,
      lead: editingSector.lead,
    });
    setEditingSector(null);
  }

  return (
    <section className="table-card sector-management-card sector-reference-page">
      <div className="sector-reference-header">
        <span className="sector-reference-icon">
          <LayoutGrid size={32} />
        </span>
        <div>
          <strong>{sectors.length} setores</strong>
          <span>Capacidade, SLA e cadastros vinculados por área produtiva</span>
        </div>
        <button className="ghost-button sector-report-button" type="button" onClick={() => onViewChange("reports")}>
          <ChartNoAxesColumn size={18} />
          Ver relatório geral
        </button>
      </div>

      <div className="sector-management-grid">
        {[...sectors].sort((a, b) => a.order - b.order).map((sector, index) => {
          const metrics = sectorLiveMetrics(sector, orders, machines, []);
          const linkedUsersCount = users.filter((u) => u.sectorIds.includes(sector.id)).length;
          const isEditing = editingSector?.id === sector.id;
          const tone = sectorTones[index % sectorTones.length];
          const Icon = sectorIcons[index % sectorIcons.length];

          return (
            <article className="sector-card reference-sector-card" style={{ "--sector-tone": tone } as CSSProperties} key={sector.id}>
              <div className="reference-sector-top">
                <span className="reference-sector-icon">
                  <Icon size={26} />
                </span>
                <div className="card-actions">
                  <label className="sector-order-label" title="Ordem do setor">
                    <input
                      className="sector-order-input"
                      type="number"
                      min={1}
                      max={sectors.length}
                      value={index + 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (val >= 1 && val <= sectors.length) {
                          onSetSectorOrder(sector.id, val - 1);
                        }
                      }}
                    />
                  </label>
                  <button className="icon-button" type="button" title="Editar setor" onClick={() => setEditingSector(sector)}>
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button danger-action"
                    type="button"
                    title="Deletar setor"
                    disabled={sectors.length <= 1}
                    onClick={() => onDeleteSector(sector.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {isEditing && editingSector ? (
                <form className="sector-edit-form" onSubmit={saveSector}>
                  <label>
                    Nome do setor
                    <input
                      value={editingSector.name}
                      onChange={(event) =>
                        setEditingSector({ ...editingSector, name: event.target.value })
                      }
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Capacidade (%)
                      <input
                        min={0}
                        max={100}
                        type="number"
                        value={editingSector.capacity}
                        onChange={(event) =>
                          setEditingSector({
                            ...editingSector,
                            capacity: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      SLA
                      <input
                        value={editingSector.sla}
                        onChange={(event) =>
                          setEditingSector({ ...editingSector, sla: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Lead médio
                      <input
                        value={editingSector.lead}
                        onChange={(event) =>
                          setEditingSector({ ...editingSector, lead: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="inline-actions">
                    <button className="primary-button compact" type="submit">
                      <Save size={16} />
                      Salvar
                    </button>
                    <button className="ghost-button compact" type="button" onClick={() => setEditingSector(null)}>
                      <X size={16} />
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="sector-main-row">
                    <div>
                      <span className="sector-orders-count">{metrics.activeOrders.length} pedidos ativos</span>
                      <h3>{sector.name}</h3>
                      <p>Lead médio {sector.lead} · SLA {sector.sla} <i /></p>
                    </div>
                    <div
                      className="capacity-ring"
                      style={
                        {
                          background: `conic-gradient(${tone} ${metrics.capacity * 3.6}deg, #e8ebf1 0deg)`,
                        } as CSSProperties
                      }
                    >
                      <span>
                        <strong>{metrics.capacity}%</strong>
                        capacidade
                      </span>
                    </div>
                  </div>

                  <ProgressBar value={metrics.capacity} color={tone} />

                  <div className="sector-metric-grid">
                    <span>
                      <i>
                        <ClipboardList size={20} />
                      </i>
                      <strong>{metrics.activeOrders.length}</strong>
                      ativos
                    </span>
                    <span>
                      <i>
                        <CheckCircle2 size={20} />
                      </i>
                      <strong>{metrics.deliveredOrders}</strong>
                      entregues
                    </span>
                    <span>
                      <i>
                        <Cpu size={20} />
                      </i>
                      <strong>{metrics.machineCount}</strong>
                      máquinas
                    </span>
                    <span>
                      <i>
                        <Users size={20} />
                      </i>
                      <strong>{linkedUsersCount}</strong>
                      usuários
                    </span>
                  </div>

                  <SectorUsersPanel
                    sector={sector}
                    users={users}
                    canManage={canManageUsers}
                    onAddUser={(userId) => onAddUserToSector(userId, sector.id)}
                    onRemoveUser={(userId) => onRemoveUserFromSector(userId, sector.id)}
                  />
                </>
              )}
            </article>
          );
        })}
      </div>

      <div className="sector-tip">
        <span>
          <Lightbulb size={30} />
        </span>
        <div>
          <strong>Dica</strong>
          <p>Vincule usuários aos setores para controlar o acesso por área produtiva e facilitar a atribuição de pedidos.</p>
        </div>
        <button className="ghost-button" type="button" onClick={() => onViewChange("reports")}>
          Saiba mais
          <ArrowUpRight size={16} />
        </button>
      </div>
    </section>
  );
}

function quoteTotal(quote: Quote) {
  return quote.items.reduce((sum, item) => sum + item.total, 0);
}

function publicQuoteLink(quote: Quote) {
  if (!quote.publicToken || typeof window === "undefined") return "";

  let quoteId = quote.publicQuoteId ?? quote.id;
  let token = quote.publicToken;

  if (quote.publicToken.startsWith("http")) {
    try {
      const publicUrl = new URL(quote.publicToken);
      token = publicUrl.searchParams.get("token") ?? "";
      const [, routeQuoteId] = publicUrl.pathname.match(/\/orcamentos?\/([^/?#]+)/) ?? [];
      quoteId = routeQuoteId ? decodeURIComponent(routeQuoteId) : quoteId;
    } catch {
      token = "";
    }
  }

  if (!token) return "";
  return `${window.location.origin}/orcamentos/${encodeURIComponent(quoteId)}?token=${encodeURIComponent(token)}`;
}

function publicOrderLink(order: Order) {
  const source = order.publicLink || order.publicToken || "";
  if (!source || typeof window === "undefined") return "";

  let orderId = order.publicOrderId ?? order.id;
  let token = source;

  if (source.startsWith("http")) {
    try {
      const publicUrl = new URL(source);
      token = publicUrl.searchParams.get("token") ?? "";
      const [, routeOrderId] = publicUrl.pathname.match(/\/pedidos?\/([^/?#]+)/) ?? [];
      orderId = routeOrderId ? decodeURIComponent(routeOrderId) : orderId;
    } catch {
      token = "";
    }
  }

  if (!token) return "";
  return `${window.location.origin}/pedidos/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`;
}

function QuotesView({
  quotes,
  onCreateQuote,
  onOpenQuote,
}: {
  quotes: Quote[];
  onCreateQuote: () => void;
  onOpenQuote: (quoteId: string) => void;
}) {
  const quotesPageSize = 10;
  const [quotePage, setQuotePage] = useState(1);
  const totalQuotePages = Math.max(1, Math.ceil(quotes.length / quotesPageSize));
  const currentQuotePage = Math.min(quotePage, totalQuotePages);
  const quotePageStart = (currentQuotePage - 1) * quotesPageSize;
  const paginatedQuotes = quotes.slice(quotePageStart, quotePageStart + quotesPageSize);
  const visibleQuoteStart = quotes.length ? quotePageStart + 1 : 0;
  const visibleQuoteEnd = Math.min(quotePageStart + paginatedQuotes.length, quotes.length);

  return (
    <section className="quote-page">
      <div className="quote-header">
        <div className="quote-title">
          <span>
            <FileText size={25} />
          </span>
          <div>
            <h1>Orçamentos</h1>
            <p>Consulte propostas salvas, links públicos e valores enviados aos clientes.</p>
          </div>
        </div>
        <div className="quote-header-actions">
          <button className="primary-button" type="button" onClick={onCreateQuote}>
            <Plus size={18} />
            Novo Orçamento
          </button>
        </div>
      </div>

      <section className="quote-created-list" aria-label="Orcamentos criados">
        <div className="quote-created-head">
          <div>
            <h2>Orçamentos criados</h2>
            <p>
              {quotes.length
                ? `${quotes.length} registros salvos • exibindo ${visibleQuoteStart}-${visibleQuoteEnd}`
                : "Nenhum orçamento criado ainda"}
            </p>
          </div>
        </div>

        {quotes.length ? (
          <>
            <div className="quote-created-table">
              {paginatedQuotes.map((quote) => {
                const publicLink = publicQuoteLink(quote);

                return (
                  <article
                    className="quote-created-row clickable-row"
                    key={quote.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenQuote(quote.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenQuote(quote.id);
                      }
                    }}
                  >
                    <div>
                      <strong>{quote.id}</strong>
                      <span>{quote.customerName}</span>
                    </div>
                    <span>{formatDateShort(quote.validUntil)}</span>
                    <span className={`quote-created-status ${normalizeText(quote.status)}`}>{quote.status}</span>
                    <strong>{formatCurrency(quoteTotal(quote))}</strong>
                    <div className="quote-created-actions">
                      {publicLink ? (
                        <>
                          <a
                            className="ghost-button"
                            href={publicLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Abrir
                          </a>
                          <button
                            className="icon-button"
                            type="button"
                            title="Copiar link público"
                            onClick={(event) => {
                              event.stopPropagation();
                              void navigator.clipboard?.writeText(publicLink);
                            }}
                          >
                            <Link2 size={16} />
                          </button>
                        </>
                      ) : (
                        <span>Sem link</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="quote-created-pagination" aria-label="Paginação de orçamentos">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setQuotePage(Math.max(1, currentQuotePage - 1))}
                disabled={currentQuotePage === 1}
              >
                <ChevronLeft size={17} />
                Anterior
              </button>
              <span>
                Página {currentQuotePage} de {totalQuotePages}
              </span>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setQuotePage(Math.min(totalQuotePages, currentQuotePage + 1))}
                disabled={currentQuotePage === totalQuotePages}
              >
                Próxima
                <ChevronRight size={17} />
              </button>
            </div>
          </>
        ) : (
          <div className="quote-created-empty">
            Clique em Novo Orçamento para criar a primeira proposta.
          </div>
        )}
      </section>
    </section>
  );
}

function QuoteEditor({
  draft,
  quotes,
  clients,
  products,
  onDraftChange,
  onAddClient,
  onSaveDraft,
  onGenerate,
}: {
  draft: QuoteDraft;
  quotes: Quote[];
  clients: Client[];
  products: Product[];
  onDraftChange: (draft: QuoteDraft) => void;
  onAddClient: () => void;
  onSaveDraft: () => void;
  onGenerate: () => void;
}) {
  const selectedClient = clients.find((client) => client.id === draft.customerId) ?? clients[0];
  const subtotal = draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountValue =
    draft.discountType === "percent" ? subtotal * (Math.min(draft.discount, 100) / 100) : draft.discount;
  const tax = Math.max(0, subtotal - discountValue) * 0.05;
  const total = Math.max(0, subtotal - discountValue + tax);
  const lastQuote = quotes.find((quote) => quote.publicToken) ?? quotes[0];
  const firstAvailableProduct =
    products.find((product) => !draft.items.some((item) => item.productId === product.id)) ?? products[0];
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemPickerDraft, setItemPickerDraft] = useState(() => ({
    productId: firstAvailableProduct?.id ?? "",
    quantity: firstAvailableProduct?.minOrderQty ?? 1,
    unitPrice: firstAvailableProduct?.price ?? 0,
  }));
  const pickerProduct = products.find((product) => product.id === itemPickerDraft.productId);

  function updateClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId);

    onDraftChange({
      ...draft,
      customerId: clientId,
      contactName: client?.name ?? "",
      customerEmail: client?.email ?? "",
      customerPhone: client?.phone ?? "",
    });
  }

  function updateItem(itemId: string, update: Partial<QuoteItem>) {
    onDraftChange({
      ...draft,
      items: draft.items.map((item) => {
        if (item.id !== itemId) return item;

        const next = { ...item, ...update };
        return {
          ...next,
          total: next.quantity * next.unitPrice,
        };
      }),
    });
  }

  function openItemPicker() {
    const product = products.find((item) => !draft.items.some((quoteItem) => quoteItem.productId === item.id)) ?? products[0];
    if (!product) return;

    setItemPickerDraft({
      productId: product.id,
      quantity: product.minOrderQty,
      unitPrice: product.price,
    });
    setItemPickerOpen(true);
  }

  function addItem() {
    const product = products.find((item) => item.id === itemPickerDraft.productId);
    if (!product || itemPickerDraft.quantity <= 0 || itemPickerDraft.unitPrice < 0) return;

    onDraftChange({
      ...draft,
      items: [
        ...draft.items,
        {
          id: `quote-draft-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          quantity: itemPickerDraft.quantity,
          unitPrice: itemPickerDraft.unitPrice,
          total: itemPickerDraft.quantity * itemPickerDraft.unitPrice,
        },
      ],
    });
    setItemPickerOpen(false);
  }

  function removeItem(itemId: string) {
    onDraftChange({ ...draft, items: draft.items.filter((item) => item.id !== itemId) });
  }

  return (
    <section className="quote-editor">
      <ModalHeader
        icon={FileText}
        title="Novo Orçamento"
        subtitle="Monte propostas, gere PDF e envie link público para aceite."
      />

      <div className="quote-editor-toolbar">
          <button className="ghost-button" type="button" onClick={onSaveDraft}>
            <Save size={18} />
            Salvar rascunho
          </button>
          <button className="primary-button" type="button" onClick={onGenerate} disabled={!draft.items.length}>
            <Send size={18} />
            Gerar PDF e enviar
          </button>
          <button className="icon-button quote-menu-button" type="button" aria-label="Mais ações" title="Mais ações">
            <MoreVertical size={20} />
          </button>
      </div>

      <div className="quote-layout">
        <div className="quote-main">
          <div className="quote-card-grid">
            <article className="quote-card">
              <h2>Dados do Cliente</h2>
              <div className="quote-form-grid two">
                <label>
                  Cliente
                  <select value={selectedClient?.id ?? ""} onChange={(event) => updateClient(event.target.value)}>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Contato
                  <input
                    value={draft.contactName}
                    placeholder="Nome do contato"
                    onChange={(event) => onDraftChange({ ...draft, contactName: event.target.value })}
                  />
                </label>
                <label>
                  E-mail
                  <input
                    value={draft.customerEmail}
                    type="email"
                    placeholder="email@exemplo.com"
                    onChange={(event) => onDraftChange({ ...draft, customerEmail: event.target.value })}
                  />
                </label>
                <label>
                  Telefone
                  <input
                    value={draft.customerPhone}
                    placeholder="(11) 99999-9999"
                    onChange={(event) => onDraftChange({ ...draft, customerPhone: event.target.value })}
                  />
                </label>
              </div>
              <button className="quote-inline-action" type="button" onClick={onAddClient}>
                <Plus size={18} />
                Novo Cliente
              </button>
            </article>

            <article className="quote-card">
              <h2>Informações do Orçamento</h2>
              <div className="quote-form-grid three">
                <label>
                  Número
                  <input value="Gerado ao salvar" readOnly />
                </label>
                <label>
                  Data
                  <span className="quote-date-input">
                    <CalendarDays size={16} />
                    <input
                      value={formatDateShort(draft.issueDate)}
                      inputMode="numeric"
                      onChange={(event) => onDraftChange({ ...draft, issueDate: parseDateInput(event.target.value) })}
                    />
                  </span>
                </label>
                <label>
                  Validade
                  <span className="quote-date-input">
                    <CalendarDays size={16} />
                    <input
                      value={formatDateShort(draft.validUntil)}
                      inputMode="numeric"
                      onChange={(event) => onDraftChange({ ...draft, validUntil: parseDateInput(event.target.value) })}
                    />
                  </span>
                </label>
                <label>
                  Condição de Pagamento
                  <select
                    value={draft.paymentCondition}
                    onChange={(event) => onDraftChange({ ...draft, paymentCondition: event.target.value })}
                  >
                    <option>50% entrada + 50% entrega</option>
                    <option>À vista no Pix</option>
                    <option>30/60 dias</option>
                    <option>Cartão em até 3x</option>
                  </select>
                </label>
                <label>
                  Prazo de Produção
                  <select
                    value={draft.productionDeadline}
                    onChange={(event) => onDraftChange({ ...draft, productionDeadline: event.target.value })}
                  >
                    <option>5 dias úteis</option>
                    <option>3 dias úteis</option>
                    <option>7 dias úteis</option>
                    <option>10 dias úteis</option>
                  </select>
                </label>
              </div>
            </article>
          </div>

          <article className="quote-card quote-items-card">
            <h2>Itens do Orçamento</h2>
            <div className="quote-items-table">
              <div className="quote-items-head">
                <span />
                <span>Produto / Serviço</span>
                <span>Descrição</span>
                <span>Qtd.</span>
                <span>Un.</span>
                <span>Valor Unit.</span>
                <span>Valor Total</span>
                <span />
              </div>
              {draft.items.length ? draft.items.map((item) => {
                const product = products.find((entry) => entry.id === item.productId);

                return (
                  <div className="quote-item-row" key={item.id}>
                    <button className="quote-drag" type="button" aria-label="Ordenar item">
                      <GripVertical size={18} />
                    </button>
                    <div className="quote-product-cell">
                      <Image
                        src={quoteProductImage(product)}
                        alt=""
                        width={52}
                        height={52}
                        className="quote-product-thumb"
                      />
                      <div>
                        <strong>{item.productName}</strong>
                        <span>{product?.stockItem ?? product?.category ?? "Produto personalizado"}</span>
                      </div>
                    </div>
                    <div className="quote-description-cell">
                      {quoteItemDescription(item.productName).map((line) => (
                        <span key={line}>• {line}</span>
                      ))}
                      {item.attachmentName && (
                        <span className="quote-item-attachment" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: 'var(--primary)', fontSize: '13px' }}>
                          <Paperclip size={14} />
                          {item.attachmentName}
                        </span>
                      )}
                      <label className="quote-item-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', cursor: 'pointer', color: 'var(--foreground-muted)', fontSize: '13px', padding: '2px 6px', border: '1px dashed var(--border)', borderRadius: '4px' }}>
                        <Upload size={13} />
                        <span>Anexar Arquivo</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.zip,.cdr,.ai"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              updateItem(item.id, {
                                attachmentName: file.name,
                                attachmentUrl: URL.createObjectURL(file),
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                    <input
                      className="quote-number-input"
                      min={1}
                      type="number"
                      value={item.quantity}
                      onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })}
                    />
                    <select className="quote-unit-select" defaultValue="un">
                      <option>un</option>
                      <option>m²</option>
                      <option>mil</option>
                    </select>
                    <input
                      className="quote-money-input"
                      min={0}
                      step="0.01"
                      type="number"
                      value={item.unitPrice}
                      onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })}
                    />
                    <strong className="quote-line-total">{formatCurrency(item.quantity * item.unitPrice)}</strong>
                    <button
                      className="quote-delete"
                      type="button"
                      aria-label="Remover item"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              }) : (
                <div className="quote-empty-items">
                  <Package size={20} />
                  <span>Nenhum item adicionado.</span>
                </div>
              )}
            </div>
            <button className="quote-add-item" type="button" onClick={openItemPicker} disabled={!products.length}>
              <Plus size={18} />
              Adicionar item
            </button>
          </article>

          <div className="quote-bottom-grid">
            <article className="quote-card">
              <h2>Observações internas (não visível para o cliente)</h2>
              <textarea
                value={draft.internalNotes}
                maxLength={300}
                placeholder="Observações internas, instruções de produção, informações importantes..."
                onChange={(event) => onDraftChange({ ...draft, internalNotes: event.target.value })}
              />
              <small>{draft.internalNotes.length}/300</small>
            </article>
            <article className="quote-card quote-attachments">
              <h2>
                <Paperclip size={18} />
                Anexos
              </h2>
              <p>Adicione arquivos como artes, referências ou briefing.</p>
              <button className="ghost-button" type="button">
                <Paperclip size={17} />
                Adicionar arquivo
              </button>
            </article>
          </div>
        </div>

        <aside className="quote-summary quote-card">
          <h2>Resumo do Orçamento</h2>
          <div className="quote-summary-lines">
            <QuoteSummaryLine label="Subtotal" value={formatCurrency(subtotal)} />
            <div className="quote-summary-discount">
              <span>Desconto</span>
              <div>
                <input
                  min={0}
                  step="0.01"
                  type="number"
                  value={draft.discount}
                  onChange={(event) => onDraftChange({ ...draft, discount: Number(event.target.value) })}
                />
                <select
                  value={draft.discountType}
                  onChange={(event) =>
                    onDraftChange({ ...draft, discountType: event.target.value as QuoteDraft["discountType"] })
                  }
                >
                  <option value="currency">R$</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
            <QuoteSummaryLine label="Impostos (5%)" value={formatCurrency(tax)} />
          </div>
          <div className="quote-total-line">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          <div className="quote-validity">
            <ShieldCheck size={18} />
            Este orçamento é válido até {formatDateShort(draft.validUntil)}
          </div>

          <label className="quote-observations">
            Observações
            <textarea
              value={draft.notes}
              maxLength={300}
              placeholder="Informações adicionais, condições especiais, observações..."
              onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })}
            />
            <small>{draft.notes.length}/300</small>
          </label>

          <div className="quote-share-box">
            <h3>Compartilhar orçamento</h3>
            <p>Gere um link público para seu cliente visualizar e aceitar este orçamento.</p>
            <button className="ghost-button" type="button" onClick={onGenerate} disabled={!draft.items.length}>
              <Link2 size={17} />
              Gerar link público
            </button>
            {lastQuote?.publicToken ? (
              <div className="public-link-field">
                <input value={publicQuoteLink(lastQuote)} readOnly />
                <button
                  className="icon-button"
                  type="button"
                  title="Copiar link"
                  onClick={() => void navigator.clipboard?.writeText(publicQuoteLink(lastQuote))}
                >
                  <Link2 size={16} />
                </button>
              </div>
            ) : null}
          </div>

          {lastQuote ? (
            <div className="quote-last-link">
              <span>Último orçamento</span>
              <strong>{lastQuote.id}</strong>
              <small>{selectedClient?.company ?? lastQuote.customerName}</small>
            </div>
          ) : null}
        </aside>
      </div>
      {itemPickerOpen ? (
        <div className="quote-item-picker-backdrop" role="dialog" aria-modal="true" aria-label="Adicionar item ao orcamento">
          <button className="quote-item-picker-scrim" type="button" aria-label="Fechar seletor" onClick={() => setItemPickerOpen(false)} />
          <form
            className="quote-item-picker quote-card"
            onSubmit={(event) => {
              event.preventDefault();
              addItem();
            }}
          >
            <div className="quote-item-picker-head">
              <div>
                <h2>Adicionar item</h2>
                <span>Selecione produto, quantidade e valor antes de incluir no orcamento.</span>
              </div>
              <button className="icon-button" type="button" aria-label="Fechar" onClick={() => setItemPickerOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="quote-form-grid two">
              <label>
                Produto
                <select
                  value={itemPickerDraft.productId}
                  onChange={(event) => {
                    const product = products.find((item) => item.id === event.target.value);
                    setItemPickerDraft({
                      productId: event.target.value,
                      quantity: product?.minOrderQty ?? 1,
                      unitPrice: product?.price ?? 0,
                    });
                  }}
                >
                  {products.map((product) => (
                    <option value={product.id} key={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unidade
                <select defaultValue="un">
                  <option>un</option>
                  <option>m2</option>
                  <option>mil</option>
                </select>
              </label>
              <label>
                Quantidade
                <input
                  min={pickerProduct?.minOrderQty ?? 1}
                  type="number"
                  value={itemPickerDraft.quantity}
                  onChange={(event) => setItemPickerDraft((current) => ({ ...current, quantity: Number(event.target.value) }))}
                />
              </label>
              <label>
                Valor unitario
                <input
                  min={0}
                  step="0.01"
                  type="number"
                  value={itemPickerDraft.unitPrice}
                  onChange={(event) => setItemPickerDraft((current) => ({ ...current, unitPrice: Number(event.target.value) }))}
                />
              </label>
            </div>
            <div className="quote-item-preview">
              <span>Produto</span>
              <strong>{pickerProduct?.name ?? "Selecione um produto"}</strong>
              <span>Total previsto</span>
              <strong>{formatCurrency(itemPickerDraft.quantity * itemPickerDraft.unitPrice)}</strong>
            </div>
            <div className="inline-actions">
              <button className="primary-button" type="submit">
                <Plus size={18} />
                Adicionar ao orcamento
              </button>
              <button className="ghost-button" type="button" onClick={() => setItemPickerOpen(false)}>
                <X size={18} />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function QuoteSummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="quote-summary-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function quoteProductImage(product?: Product): string {
  if (!product) return "/assets/category-folders.jpg";
  const lookup = normalizeText(`${product.name} ${product.category} ${product.stockItem}`);
  if (product.id === "prod-cartoes") return "/assets/category-business-cards.jpg";
  if (product.id === "prod-banners") return "/assets/category-banners.jpg";
  if (product.id === "prod-adesivos") return "/assets/category-stickers.jpg";
  if (product.id === "prod-canetas") return "/assets/category-mugs.jpg";
  if (lookup.includes("adesivo") || lookup.includes("sticker")) return "/assets/category-stickers.jpg";
  if (lookup.includes("cartao")) return "/assets/category-business-cards.jpg";
  if (lookup.includes("banner") || lookup.includes("lona")) return "/assets/category-banners.jpg";
  if (lookup.includes("folder") || lookup.includes("panfleto")) return "/assets/category-folders.jpg";
  return inventoryImages[product.stockItem] ?? "/assets/category-packages.jpg";
}

function productDisplayImage(product?: Product): string {
  const thumbnail = product?.thumbnailUrl?.trim();
  if (thumbnail && !thumbnail.includes("images.unsplash.com")) {
    return thumbnail;
  }

  return quoteProductImage(product);
}

function quoteItemDescription(productName: string): string[] {
  const normalized = normalizeText(productName);

  if (normalized.includes("folder")) {
    return ["1 dobra", "4x4 cores"];
  }

  if (normalized.includes("cartao") || normalized.includes("cart")) {
    return ["4x4 cores", "Verniz frontal"];
  }

  if (normalized.includes("banner")) {
    return ["Impressão alta resolução", "Acabamento com bastão e cordão"];
  }

  return ["Acabamento, material, cores...", "Conferência final inclusa"];
}

function formatDateShort(value: string): string {
  if (!value) return "--/--/----";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function parseDateInput(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function FinanceView({
  finance,
  onCreateExpense: _onCreateExpense,
  onScheduleCharge: _onScheduleCharge,
  onSendReminder: _onSendReminder,
}: {
  finance: FinanceEntry[];
  onCreateExpense: () => void;
  onScheduleCharge: () => void;
  onSendReminder: () => void;
}) {
  const receivable = finance
    .filter((entry) => entry.type === "receivable")
    .reduce((sum, entry) => sum + entry.value, 0);
  const payable = finance
    .filter((entry) => entry.type === "payable")
    .reduce((sum, entry) => sum + entry.value, 0);
  const cash = finance.find((entry) => entry.type === "cash")?.value ?? 0;
  const projectedCash = cash + receivable - payable;
  const cashflowDelta = projectedCash - cash;
  const projected7Days = cash + cashflowDelta * 0.19445;
  const projected15Days = cash + cashflowDelta * 0.54518;
  const balance = receivable - payable;
  const margin = finance.find((entry) => entry.type === "margin")?.value ?? 0;
  const profit = finance.find((entry) => entry.type === "profit")?.value ?? 0;
  const projectionPoints = [
    { label: "Hoje", days: 0, value: cash, tone: "#5b45ff" },
    { label: "7 dias", days: 7, value: projected7Days, tone: "#0a84ff" },
    { label: "15 dias", days: 15, value: projected15Days, tone: "#ff7a00" },
    { label: "30 dias", days: 30, value: projectedCash, tone: projectedCash < 0 ? "#ee3045" : "#16b981" },
  ];
  const financeReport = [
    "Periodo;Data;Valor",
    ...projectionPoints.map((item) => `${item.label};${financeProjectionDate(item.days)};${formatCurrency(item.value)}`),
    "",
    "Conta;Tipo;Valor;Status;Vencimento",
    ...finance.map((entry) => `${entry.label};${entry.type};${entry.type === "margin" ? `${entry.value}%` : formatCurrency(entry.value)};${entry.status};${entry.due}`),
    `Saldo projetado;cash;${formatCurrency(projectedCash)};Projetado;30 dias`,
  ].join("\n");
  const forecastItems = projectionPoints.map((item) => ({ label: item.label, value: item.value, tone: item.tone }));
  const cashFlowSeries = chartSeries(forecastItems.map((item) => item.value));
  const breakdown = [
    { label: "Receber", value: receivable, percent: 100, color: "#16b981" },
    { label: "Pagar", value: payable, percent: Math.round((payable / Math.max(receivable, 1)) * 100), color: "#ee3045" },
    { label: "Lucro", value: profit, percent: Math.round((profit / Math.max(receivable, 1)) * 100), color: "#5b45ff" },
    { label: "Caixa", value: cash, percent: Math.round((cash / Math.max(receivable, 1)) * 100), color: "#0a84ff" },
  ];
  const onCreateExpense = _onCreateExpense;
  const onScheduleCharge = _onScheduleCharge;
  const onSendReminder = _onSendReminder;

  return (
    <section className="finance-page">
      <section className="cashflow-reference-card">
        <div className="cashflow-reference-head">
          <div className="cashflow-reference-title">
            <span>
              <CircleDollarSign size={30} />
            </span>
            <strong>Fluxo de Caixa</strong>
          </div>
          <button className="cashflow-export-button" type="button" onClick={() => downloadReportFile("financeiro-fluxo-caixa.csv", financeReport)}>
            <Download size={20} />
            Exportar
            <ChevronDown size={18} />
          </button>
        </div>

        <div className="cashflow-reference-balance">
          <span>
            Saldo projetado em 30 dias
            <Info size={18} />
          </span>
          <strong className={projectedCash < 0 ? "negative" : "positive"}>{formatCurrency(projectedCash)}</strong>
          <p>Projeção considerando recebíveis e contas a pagar</p>
        </div>

        <FinanceCashflowChart points={projectionPoints} />

        <div className="cashflow-period-grid">
          {projectionPoints.map((item, index) => (
            <FinanceProjectionCard
              item={item}
              previousValue={projectionPoints[index - 1]?.value}
              key={item.label}
            />
          ))}
        </div>

        <p className="cashflow-reference-note">
          <Info size={17} />
          Os valores são projeções e podem sofrer alterações.
        </p>
      </section>

      <section className="finance-summary">
        <MetricMini label="Receber" value={formatCurrency(receivable)} tone="#16b981" />
        <MetricMini label="Pagar" value={formatCurrency(payable)} tone="#ee3045" />
        <MetricMini label="Saldo aberto" value={formatCurrency(balance)} tone="#5b45ff" />
        <MetricMini label="Margem" value={`${margin}%`} tone="#0a84ff" />
      </section>

      <section className="finance-layout finance-layout-main">
        <SectionCard
          title="Fluxo de Caixa"
          action={<DownloadButton filename="financeiro-fluxo-caixa.csv" content={financeReport} />}
        >
          <div className="revenue-title">
            <strong>{formatCurrency(projectedCash)}</strong>
            <span>Projeção considerando recebíveis e contas a pagar</span>
          </div>
          <AreaChart data={cashFlowSeries} color="#10b95b" />
          <div className="finance-forecast">
            {forecastItems.map((item) => (
              <article key={item.label} style={{ "--tone": item.tone } as CSSProperties}>
                <span>{item.label}</span>
                <strong>{formatCurrency(item.value)}</strong>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Ações Financeiras"
          action={
            <button className="primary-button" type="button" onClick={onCreateExpense}>
              <Plus size={18} />
              Despesa
            </button>
          }
        >
          <div className="finance-action-list">
            <button type="button" onClick={() => downloadReportFile("financeiro-resumo.csv", financeReport)}>
              <Download size={18} />
              Exportar financeiro
            </button>
            <button type="button" onClick={onScheduleCharge}>
              <CalendarDays size={18} />
              Agendar cobrança
            </button>
            <button type="button" onClick={onSendReminder}>
              <Send size={18} />
              Enviar lembrete
            </button>
          </div>
          <div className="cash-highlight">
            <CircleDollarSign size={26} />
            <span>Fluxo líquido aberto</span>
            <strong>{formatCurrency(balance)}</strong>
          </div>
        </SectionCard>
      </section>

      <section className="finance-layout">
        <section className="table-card">
          <div className="table-toolbar">
            <div>
              <strong>Lançamentos</strong>
              <span>Contas, fluxo e projeções</span>
            </div>
            <DownloadButton filename="financeiro-lancamentos.csv" content={financeReport} />
          </div>
          <div className="finance-list">
            {finance.map((entry) => (
              <FinanceLine entry={entry} key={entry.id} />
            ))}
          </div>
        </section>

        <SectionCard title="Distribuição Financeira">
          <div className="finance-breakdown">
            {breakdown.map((item) => (
              <article key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.value)}</strong>
                </div>
                <ProgressBar value={Math.min(100, item.percent)} color={item.color} />
              </article>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="finance-layout finance-layout-bottom">
        <SectionCard title="Recebíveis e Indicadores">
          <div className="finance-queue">
            {finance.filter((entry) => entry.type !== "payable").map((entry) => (
              <article key={entry.id}>
                <span className="positive">{entry.status}</span>
                <div>
                  <strong>{entry.label}</strong>
                  <small>Vencimento: {entry.due}</small>
                </div>
                <strong>{entry.type === "margin" ? `${entry.value}%` : formatCurrency(entry.value)}</strong>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Contas a Pagar">
          <div className="finance-queue">
            {finance.filter((entry) => entry.type === "payable").map((entry) => (
              <article key={entry.id}>
                <span className="negative">{entry.status}</span>
                <div>
                  <strong>{entry.label}</strong>
                  <small>Vencimento: {entry.due}</small>
                </div>
                <strong>{formatCurrency(entry.value)}</strong>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>
    </section>
  );
}

function financeProjectionDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function financeCurrencyClass(value: number): "positive" | "negative" {
  return value < 0 ? "negative" : "positive";
}

function FinanceCashflowChart({
  points,
}: {
  points: Array<{ label: string; days: number; value: number; tone: string }>;
}) {
  const width = 1180;
  const height = 270;
  const chartLeft = 74;
  const chartRight = 34;
  const chartTop = 30;
  const chartBottom = 54;
  const chartWidth = width - chartLeft - chartRight;
  const chartHeight = height - chartTop - chartBottom;
  const values = points.map((point) => point.value);
  const minValue = Math.min(-15000, ...values);
  const maxValue = Math.max(5000, ...values);
  const yForValue = (value: number) => chartTop + ((maxValue - value) / Math.max(maxValue - minValue, 1)) * chartHeight;
  const xForIndex = (index: number) => chartLeft + (chartWidth / Math.max(points.length - 1, 1)) * index;
  const linePoints = points.map((point, index) => `${xForIndex(index)},${yForValue(point.value)}`).join(" ");
  const zeroY = yForValue(0);
  const areaPoints = `${chartLeft},${zeroY} ${linePoints} ${chartLeft + chartWidth},${zeroY}`;
  const useReferenceTicks = maxValue <= 5000 && minValue >= -15000;
  const ticks = useReferenceTicks
    ? [-15000, -10000, -5000, 0, 5000]
    : financeDynamicTicks(minValue, maxValue);

  return (
    <svg className="cashflow-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Projeção do fluxo de caixa">
      <defs>
        <linearGradient id="cashflow-area-positive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16b981" stopOpacity="0.18" />
          <stop offset="1" stopColor="#16b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cashflow-area-negative" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ee3045" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ee3045" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cashflow-line-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#16b981" />
          <stop offset="0.44" stopColor="#16b981" />
          <stop offset="0.64" stopColor="#ff7a00" />
          <stop offset="1" stopColor="#ee3045" />
        </linearGradient>
        <clipPath id="cashflow-positive-clip">
          <rect x={chartLeft} y={chartTop} width={chartWidth} height={Math.max(zeroY - chartTop, 0)} />
        </clipPath>
        <clipPath id="cashflow-negative-clip">
          <rect x={chartLeft} y={zeroY} width={chartWidth} height={Math.max(chartTop + chartHeight - zeroY, 0)} />
        </clipPath>
      </defs>
      <line className="cashflow-zero-line" x1={chartLeft} x2={chartLeft + chartWidth} y1={zeroY} y2={zeroY} />
      {ticks.map((tick) => (
        <g key={tick}>
          {tick !== 0 ? <line className="cashflow-grid-line" x1={chartLeft} x2={chartLeft + chartWidth} y1={yForValue(tick)} y2={yForValue(tick)} /> : null}
          <text className="cashflow-axis-label" x={chartLeft - 18} y={yForValue(tick) + 5} textAnchor="end">
            {financeAxisLabel(tick)}
          </text>
        </g>
      ))}
      <polygon className="cashflow-area-positive" clipPath="url(#cashflow-positive-clip)" points={areaPoints} />
      <polygon className="cashflow-area-negative" clipPath="url(#cashflow-negative-clip)" points={areaPoints} />
      <polyline className="cashflow-main-line" points={linePoints} />
      {points.map((point, index) => {
        const x = xForIndex(index);
        const y = yForValue(point.value);
        return (
          <g key={point.label}>
            <circle className={`cashflow-point ${financeCurrencyClass(point.value)}`} cx={x} cy={y} r="5.8" />
            <foreignObject x={index === 0 ? x + 10 : index === points.length - 1 ? x - 102 : x + 9} y={y - 36} width="118" height="30">
              <div className={`cashflow-value-label ${financeCurrencyClass(point.value)}`}>{formatCurrency(point.value)}</div>
            </foreignObject>
            <text className="cashflow-x-label" x={x} y={height - 28} textAnchor="middle">{point.label}</text>
            <text className="cashflow-x-date" x={x} y={height - 12} textAnchor="middle">{financeProjectionDate(point.days)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function financeAxisLabel(value: number): string {
  if (value === 0) return "R$ 0";
  const abs = Math.abs(value) / 1000;
  return `${value < 0 ? "-" : ""}R$ ${formatNumber(abs)} mil`;
}

function financeDynamicTicks(minValue: number, maxValue: number): number[] {
  const range = Math.max(maxValue - minValue, 1);
  const roughStep = range / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceStep = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const start = Math.floor(minValue / niceStep) * niceStep;
  const ticks: number[] = [];

  for (let value = start; value <= maxValue + niceStep; value += niceStep) {
    ticks.push(value);
  }

  if (!ticks.includes(0)) {
    ticks.push(0);
  }

  return ticks.sort((a, b) => a - b).slice(-6);
}

function FinanceProjectionCard({
  item,
  previousValue,
}: {
  item: { label: string; days: number; value: number; tone: string };
  previousValue?: number;
}) {
  const isNegative = item.value < 0;
  const base = Math.abs(previousValue ?? item.value);
  const dropPercent = previousValue === undefined || base === 0
    ? null
    : Math.abs(((item.value - previousValue) / base) * 100);
  const trendLabel = dropPercent === null
    ? item.value >= 0 ? "Positivo" : "Negativo"
    : `Queda de ${formatNumber(Number(dropPercent.toFixed(1)))}%`;

  return (
    <article className={`cashflow-period-card ${financeCurrencyClass(item.value)}`} style={{ "--period-tone": item.tone } as CSSProperties}>
      <div className="cashflow-period-head">
        <span>
          <CalendarDays size={22} />
        </span>
        <strong>{item.label}</strong>
      </div>
      <b>{formatCurrency(item.value)}</b>
      <MiniCashflowSparkline color={item.tone} negative={isNegative} />
      <div className="cashflow-period-foot">
        <em>{trendLabel}</em>
        {dropPercent !== null ? <ChevronDown size={19} /> : null}
      </div>
    </article>
  );
}

function MiniCashflowSparkline({ color, negative }: { color: string; negative: boolean }) {
  const points = negative
    ? "0,28 16,24 32,26 48,22 64,25 80,23 96,27 112,29 128,31 144,34 160,33 176,36 192,35 214,42"
    : "0,36 16,30 32,26 48,27 64,24 80,25 96,23 112,25 128,24 144,28 160,29 176,31 192,30 214,37";
  const gradientId = `mini-${color.replace(/[^a-z0-9]/gi, "")}-${negative ? "neg" : "pos"}`;

  return (
    <svg className="cashflow-mini-chart" viewBox="0 0 214 54" role="img" aria-label="Tendência do período">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,54 ${points} 214,54`} fill={`url(#${gradientId})`} />
      <polyline fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" points={points} />
    </svg>
  );
}

function ReportsView({
  orders,
  finance,
  sectors,
  report,
}: {
  orders: Order[];
  finance: FinanceEntry[];
  sectors: Sector[];
  report: ManagementReport | null;
}) {
  const localRevenue = orders.filter((order) => !isCanceledOrderStatus(order.status)).reduce((sum, order) => sum + order.total, 0);
  const totalRevenue = reportValue(report?.sales, "confirmedRevenue", localRevenue);
  const averageTicket = reportValue(report?.sales, "averageTicket", totalRevenue / Math.max(orders.filter((order) => !isCanceledOrderStatus(order.status)).length, 1));
  const deliveredOrders = orders.filter((order) => isDeliveredOrderStatus(order.status)).length;
  const openOrders = reportValue(report?.sales, "openOrders", orders.filter((order) => !isClosedOrderStatus(order.status)).length);
  const averageProgress = Math.round(
    orders.reduce((sum, order) => sum + order.progress, 0) / Math.max(orders.length, 1),
  );
  const averageCapacity = Math.round(
    sectors.reduce((sum, sector) => sum + sector.capacity, 0) / Math.max(sectors.length, 1),
  );
  const receivable = reportValue(report?.finance, "receivable", sumFinance(finance, "receivable"));
  const payable = reportValue(report?.finance, "payable", sumFinance(finance, "payable"));
  const profit = finance.find((entry) => entry.type === "profit")?.value ?? 0;
  const margin = finance.find((entry) => entry.type === "margin")?.value ?? 0;
  const cash = reportValue(report?.finance, "projectedCash", sumFinance(finance, "cash"));
  const busiestSector = [...sectors].sort((a, b) => b.capacity - a.capacity)[0];
  const statusRows = (Object.keys(statusMeta) as OrderStatus[]).map((status) => ({
    label: statusMeta[status].label,
    count: orders.filter((order) => order.status === status).length,
  }));
  const reportRevenueSeries = cumulativeSeriesFrom(orders.map((order) => order.total));
  const monthlyReport = [
    "Indicador;Valor",
    `Faturamento mensal;${formatCurrency(totalRevenue)}`,
    `Ticket médio;${formatCurrency(averageTicket)}`,
    `Lucro do mês;${formatCurrency(profit)}`,
    `Margem operacional;${margin}%`,
  ].join("\n");
  const statusReport = [
    "Status;Quantidade",
    ...statusRows.map((row) => `${row.label};${row.count}`),
  ].join("\n");
  const financeReport = [
    "Conta;Valor;Status;Vencimento",
    ...finance.map((entry) => `${entry.label};${entry.type === "margin" ? `${entry.value}%` : formatCurrency(entry.value)};${entry.status};${entry.due}`),
  ].join("\n");
  const operationReport = [
    "Setor;Pedidos;Capacidade;SLA;Lead",
    ...sectors.map((sector) => `${sector.name};${sector.orders};${sector.capacity}%;${sector.sla};${sector.lead}`),
  ].join("\n");
  const executiveReport = [
    "Leitura;Resumo",
    `Financeiro;Fluxo positivo de ${formatCurrency(receivable - payable)}`,
    `Operação;${busiestSector?.name ?? "Produção"} concentra a maior carga operacional`,
    `Pedidos;${formatNumber(openOrders)} abertos e ${formatNumber(deliveredOrders)} entregues`,
  ].join("\n");
  const reportItems: Array<{
    title: string;
    detail: string;
    icon: LucideIcon;
    tone: string;
    filename: string;
    content: string;
  }> = [
    {
      title: "DRE resumida",
      detail: "Receitas, despesas, lucro e margem operacional.",
      icon: CircleDollarSign,
      tone: "#16b981",
      filename: "dre-resumida.csv",
      content: financeReport,
    },
    {
      title: "Produção por setor",
      detail: "Capacidade, pedidos ativos, SLA e gargalos.",
      icon: Factory,
      tone: "#5b45ff",
      filename: "producao-por-setor.csv",
      content: operationReport,
    },
    {
      title: "Pedidos por status",
      detail: "Aprovação, pagamento, produção, conferência e expedição.",
      icon: ClipboardList,
      tone: "#0a84ff",
      filename: "pedidos-por-status.csv",
      content: statusReport,
    },
    {
      title: "Fluxo de caixa",
      detail: "Entradas, saídas, saldo diário e projeção.",
      icon: WalletCards,
      tone: "#ff7a00",
      filename: "fluxo-de-caixa.csv",
      content: financeReport,
    },
    {
      title: "Performance comercial",
      detail: "Ticket médio, volume vendido e tendência de faturamento.",
      icon: ArrowUpRight,
      tone: "#c026d3",
      filename: "performance-comercial.csv",
      content: monthlyReport,
    },
  ];

  return (
    <section className="reports-page">
      <section className="report-summary">
        <article>
          <span>
            <CircleDollarSign size={20} />
          </span>
          <div>
            <small>Faturamento projetado</small>
            <strong>{formatCurrency(totalRevenue + receivable)}</strong>
          </div>
        </article>
        <article>
          <span>
            <ClipboardList size={20} />
          </span>
          <div>
            <small>Pedidos em análise</small>
            <strong>{formatNumber(openOrders)}</strong>
          </div>
        </article>
        <article>
          <span>
            <Percent size={20} />
          </span>
          <div>
            <small>Margem operacional</small>
            <strong>{margin}%</strong>
          </div>
        </article>
        <article>
          <span>
            <Factory size={20} />
          </span>
          <div>
            <small>Capacidade média</small>
            <strong>{averageCapacity}%</strong>
          </div>
        </article>
      </section>

      <section className="reports-grid reports-grid-main">
        <SectionCard title="Faturamento Mensal" action={<DownloadButton filename="faturamento-mensal.csv" content={monthlyReport} />}>
          <div className="revenue-title">
            <strong>{formatCurrency(totalRevenue)}</strong>
            <span>Ticket médio {formatCurrency(averageTicket)} · lucro {formatCurrency(profit)}</span>
          </div>
          <AreaChart data={reportRevenueSeries} color="#4f46ff" />
          <div className="report-axis">
            <span>Inicio</span>
            <span>Pedidos</span>
            <span>Hoje</span>


          </div>
        </SectionCard>

        <SectionCard title="Pedidos por Status" action={<DownloadButton filename="pedidos-por-status.csv" content={statusReport} />}>
          <StatusDonut orders={orders} />
        </SectionCard>

        <SectionCard title="Resumo Financeiro" action={<DownloadButton filename="resumo-financeiro.csv" content={financeReport} />}>
          <div className="report-metrics">
            <MetricMini label="Receber" value={formatCurrency(receivable)} tone="#16b981" />
            <MetricMini label="Pagar" value={formatCurrency(payable)} tone="#ee3045" />
            <MetricMini label="Caixa" value={formatCurrency(cash)} tone="#5b45ff" />
          </div>
          <div className="report-finance-list">
            {finance.map((entry) => (
              <FinanceLine entry={entry} key={entry.id} compact />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Operação e Produção" action={<DownloadButton filename="operacao-e-producao.csv" content={operationReport} />}>
          <div className="report-metrics">
            <MetricMini label="Progresso médio" value={`${averageProgress}%`} tone="#5b45ff" />
            <MetricMini label="Setores ativos" value={formatNumber(sectors.length)} tone="#0a84ff" />
            <MetricMini label="Maior carga" value={busiestSector ? `${busiestSector.capacity}%` : "0%"} tone="#ff7a00" />
          </div>
          <SectorBars sectors={sectors} />
        </SectionCard>
      </section>

      <section className="reports-grid reports-grid-secondary">
        <SectionCard title="Relatórios Prontos" action={<DownloadButton filename="relatorios-prontos.csv" content={executiveReport} />}>
          <div className="report-list">
            {reportItems.map(({ title, detail, icon: Icon, tone, filename, content }) => (
              <article className="report-list-item" key={title}>
                <span style={{ "--tone": tone } as CSSProperties}>
                  <Icon size={19} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
                <button className="ghost-button compact" type="button" onClick={() => downloadReportFile(filename, content)}>
                  <Download size={15} />
                  Baixar
                </button>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Leitura Executiva">
          <div className="report-insights">
            <article>
              <CheckCircle2 size={18} />
              <span>Fluxo financeiro positivo de {formatCurrency(receivable - payable)} considerando contas abertas.</span>
            </article>
            <article>
              <AlertTriangle size={18} />
              <span>{busiestSector?.name ?? "Produção"} concentra a maior carga operacional no período.</span>
            </article>
            <article>
              <Eye size={18} />
              <span>{formatNumber(openOrders)} pedidos seguem abertos e {formatNumber(deliveredOrders)} foram entregues no recorte atual.</span>
            </article>
          </div>
        </SectionCard>
      </section>
    </section>
  );
}

function FilesView({
  files,
  onUploadFile,
  onCreateFile,
  onUpdateFile,
  onDeleteFile,
}: {
  files: FileItem[];
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onCreateFile: () => void;
  onUpdateFile: (fileId: string, update: Partial<Omit<FileItem, "id" | "updatedAt">>) => void | Promise<void>;
  onDeleteFile: (fileId: string) => void | Promise<void>;
}) {
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<FileItem>>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filteredFiles = files.filter((file) => {
    const haystack = `${file.name} ${file.type} ${file.linkedTo} ${file.owner ?? ""} ${file.notes ?? ""}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const pageCount = Math.max(1, Math.ceil(filteredFiles.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedFiles = filteredFiles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="table-card">
      <div className="table-toolbar">
        <div>
          <strong>{files.length} arquivos</strong>
          <span>Biblioteca vinculada a pedidos e financeiro</span>
        </div>
        <label className="toolbar-search">
          <Search size={16} />
          <input
            type="search"
            value={search}
            placeholder="Buscar arquivo, vinculo ou responsavel"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <button className="primary-button" type="button" onClick={onCreateFile}>
          <Upload size={18} />
          Upload
        </button>
      </div>
      <div className="file-list">
        {paginatedFiles.map((file) => (
          <article className="file-row" key={file.id}>
            <span className="file-icon">
              <FileText size={20} />
            </span>
            <div>
              <strong>{file.name}</strong>
              <span>
                {file.type} · {file.linkedTo}
              </span>
            </div>
            <small className="file-meta">{file.owner || "Sem responsavel"} {file.notes ? `- ${file.notes}` : ""}</small>
            <span>{file.size}</span>
            <span>{file.updatedAt}</span>
            {editingFileId === file.id ? (
              <form
                className="inline-edit-panel file-edit-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onUpdateFile(file.id, drafts[file.id] ?? {});
                  setEditingFileId(null);
                }}
              >
                <input
                  value={drafts[file.id]?.name ?? file.name}
                  onChange={(event) => setDrafts((current) => ({ ...current, [file.id]: { ...current[file.id], name: event.target.value } }))}
                />
                <input
                  value={drafts[file.id]?.linkedTo ?? file.linkedTo}
                  onChange={(event) => setDrafts((current) => ({ ...current, [file.id]: { ...current[file.id], linkedTo: event.target.value } }))}
                />
                <label className="upload-field inline-upload">
                  <Upload size={15} />
                  <span>{drafts[file.id]?.url || file.url ? "Arquivo enviado" : "Enviar arquivo"}</span>
                  <input
                    type="file"
                    onChange={async (event) => {
                      const input = event.currentTarget;
                      const selected = event.target.files?.[0];
                      if (!selected) return;
                      const uploaded = await safeUploadFile(onUploadFile, selected, "files");
                      if (!uploaded) {
                        input.value = "";
                        return;
                      }
                      setDrafts((current) => ({
                        ...current,
                        [file.id]: {
                          ...current[file.id],
                          name: current[file.id]?.name ?? uploaded.name,
                          url: uploaded.url,
                          size: `${(uploaded.size / 1024 / 1024).toFixed(2)} MB`,
                        },
                      }));
                      input.value = "";
                    }}
                  />
                </label>
                <button className="primary-button compact" type="submit">
                  <Save size={15} />
                  Salvar
                </button>
              </form>
            ) : null}
            <div className="row-actions">
              <button
                className="icon-button"
                type="button"
                aria-label="Baixar arquivo"
                title="Baixar arquivo"
                onClick={() => {
                  if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
                }}
              >
                <Download size={18} />
              </button>
              <button className="icon-button" type="button" aria-label="Editar arquivo" title="Editar arquivo" onClick={() => setEditingFileId(editingFileId === file.id ? null : file.id)}>
                <Pencil size={16} />
              </button>
              <button className="icon-button danger-action" type="button" aria-label="Excluir arquivo" title="Excluir arquivo" onClick={() => void onDeleteFile(file.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
        {!paginatedFiles.length ? (
          <div className="empty-state">
            <Folder size={20} />
            Nenhum arquivo encontrado.
          </div>
        ) : null}
      </div>
      <div className="pagination-row">
        <span>
          Pagina {currentPage} de {pageCount} - {filteredFiles.length} arquivos
        </span>
        <div>
          <button className="ghost-button compact" type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Anterior
          </button>
          <button className="ghost-button compact" type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
            Proxima
          </button>
        </div>
      </div>
    </section>
  );
}

function NotificationsView({
  notifications,
  onRead,
  onRemove,
}: {
  notifications: NotificationItem[];
  onRead: (notificationId: string) => void;
  onRemove: (notificationId: string) => void;
}) {
  return (
    <section className="notification-page">
      {notifications.map((notification) => (
        <article className={`notification-row ${notification.read ? "read" : ""}`} key={notification.id}>
          <NotificationIcon tone={notification.tone} />
          <div>
            <strong>{notification.title}</strong>
            <span>{notification.message}</span>
            {notification.fields?.length ? (
              <div className="notification-fields" aria-label="Campos destacados">
                {notification.fields.map((field) => (
                  <span key={`${notification.id}-${field}`} className="notification-field">
                    {formatNotificationField(field)}
                  </span>
                ))}
              </div>
            ) : null}
            <small>{notification.time}</small>
          </div>
          <div className="row-actions">
            <button className="icon-button" type="button" onClick={() => onRead(notification.id)} aria-label="Marcar como lida" title="Marcar como lida">
              <Check size={18} />
            </button>
            <button className="icon-button" type="button" onClick={() => onRemove(notification.id)} aria-label="Remover" title="Remover">
              <Trash2 size={18} />
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function SettingsView({
  dark,
  onToggleTheme,
  onRefreshData,
}: {
  dark: boolean;
  onToggleTheme: () => void;
  onRefreshData: () => void;
}) {
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>({
    tenant: "GraphFlow Matriz",
    profile: "Administrador",
    unit: "São Paulo",
    mfa: "Obrigatório",
    criticalAlerts: "Ativos",
    audit: "30 dias",
    provider: "Keycloak OIDC",
    session: "Cookie httpOnly + SameSite",
    permissions: "Por usuário e setor",
    kanban: "Sincronizado com setores",
    machines: "Uso por pedidos",
    inventory: "Mínimos, imagens e movimentações",
    quotes: "PDF, link público e aceite",
    publicLinks: "Token com expiração",
    notifications: "Painel interno",
  });
  const [activeSetting, setActiveSetting] = useState<SettingsItemConfig | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [settingsFeedback, setSettingsFeedback] = useState("");

  const settingCards: SettingsCardConfig[] = [
    {
      title: "Conta",
      subtitle: "Informações básicas da sua conta",
      icon: Users,
      tone: "#6b45ff",
      rows: [
        { key: "tenant", icon: Building2, label: "Tenant", value: settingsValues.tenant, options: ["GraphFlow Matriz", "GraphFlow Unidade 02", "GraphFlow Franquia"] },
        { key: "profile", icon: Users, label: "Perfil", value: settingsValues.profile, options: ["Administrador", "Gerente", "Operador", "Cliente"] },
        { key: "unit", icon: MapPin, label: "Unidade", value: settingsValues.unit, options: ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba"] },
      ],
    },
    {
      title: "Segurança",
      subtitle: "Proteja sua conta e dados",
      icon: ShieldCheck,
      tone: "#16b981",
      rows: [
        { key: "mfa", icon: LockKeyhole, label: "MFA TOTP", value: settingsValues.mfa, pill: "success", options: ["Obrigatório", "Opcional", "Desativado"] },
        { key: "criticalAlerts", icon: BellRing, label: "Alertas críticos", value: settingsValues.criticalAlerts, pill: "success", options: ["Ativos", "Somente e-mail", "Desativados"] },
        { key: "audit", icon: Eye, label: "Auditoria", value: settingsValues.audit, options: ["7 dias", "30 dias", "90 dias", "180 dias"] },
      ],
    },
    {
      title: "Preferências",
      subtitle: "Personalize sua experiência",
      icon: Settings,
      tone: "#6b45ff",
      actions: [
        {
          label: "Tema",
          icon: dark ? Sun : Moon,
          onClick: () => {
            onToggleTheme();
            setSettingsFeedback(`Tema alterado para ${dark ? "claro" : "escuro"}.`);
          },
        },
        {
          label: "Atualizar dados",
          icon: RefreshCw,
          onClick: () => {
            onRefreshData();
            setSettingsFeedback("Dados sincronizados com o banco.");
          },
        },
      ],
    },
    {
      title: "Autenticação",
      subtitle: "Métodos e permissões de acesso",
      icon: ShieldCheck,
      tone: "#236dff",
      rows: [
        { key: "provider", icon: LockKeyhole, label: "Provedor", value: settingsValues.provider, options: ["Keycloak OIDC", "Supabase Auth", "OIDC customizado"] },
        { key: "session", icon: ShieldCheck, label: "Sessão", value: settingsValues.session, options: ["Cookie httpOnly + SameSite", "JWT curto + refresh", "Sessão restrita por IP"] },
        { key: "permissions", icon: UserCog, label: "Permissões", value: settingsValues.permissions, options: ["Por usuário e setor", "Somente por perfil", "Perfil + unidade"] },
      ],
    },
    {
      title: "Operação",
      subtitle: "Configurações do dia a dia",
      icon: Cpu,
      tone: "#ff9f1c",
      rows: [
        { key: "kanban", icon: Factory, label: "Kanban", value: settingsValues.kanban, options: ["Sincronizado com setores", "Manual por estágio", "Por setor e máquina"] },
        { key: "machines", icon: Settings, label: "Máquinas", value: settingsValues.machines, options: ["Uso por pedidos", "Uso manual", "Uso por ordem de produção"] },
        { key: "inventory", icon: Boxes, label: "Estoque", value: settingsValues.inventory, options: ["Mínimos, imagens e movimentações", "Somente mínimos", "Lote, validade e movimentações"] },
      ],
    },
    {
      title: "Comercial",
      subtitle: "Ferramentas e comunicação",
      icon: ShoppingBag,
      tone: "#16b981",
      rows: [
        { key: "quotes", icon: FileText, label: "Orçamentos", value: settingsValues.quotes, options: ["PDF, link público e aceite", "Somente PDF", "Link público sem aceite"] },
        { key: "publicLinks", icon: Link2, label: "Links públicos", value: settingsValues.publicLinks, options: ["Token com expiração", "Token fixo", "Expiração por orçamento"] },
        { key: "notifications", icon: BellRing, label: "Notificações", value: settingsValues.notifications, options: ["Painel interno", "Painel + WhatsApp", "Painel + e-mail"] },
      ],
    },
  ];

  function openSetting(setting: SettingsItemConfig) {
    setActiveSetting(setting);
    setEditingValue(setting.value);
    setSettingsFeedback("");
  }

  function saveSetting() {
    if (!activeSetting) return;
    setSettingsValues((current) => ({ ...current, [activeSetting.key]: editingValue }));
    setSettingsFeedback(`${activeSetting.label} atualizado.`);
    setActiveSetting(null);
  }

  return (
    <section className="settings-reference-page table-card">
      <div className="settings-reference-head">
        <h2>Configurações</h2>
        <p>Gerencie as preferências e configurações da sua conta.</p>
      </div>

      <div className="settings-reference-grid">
        {settingCards.map((card) => (
          <SettingsReferenceCard card={card} key={card.title} onOpenSetting={openSetting} />
        ))}
      </div>

      {settingsFeedback ? (
        <div className="settings-feedback">
          <CheckCircle2 size={18} />
          {settingsFeedback}
        </div>
      ) : null}

      {activeSetting ? (
        <SettingsConfigDialog
          setting={activeSetting}
          value={editingValue}
          onChange={setEditingValue}
          onClose={() => setActiveSetting(null)}
          onSave={saveSetting}
        />
      ) : null}
    </section>
  );
}

type SettingsItemConfig = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  pill?: "success";
  options?: string[];
};

type SettingsActionConfig = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

type SettingsCardConfig = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: string;
  rows?: SettingsItemConfig[];
  actions?: SettingsActionConfig[];
};

function SettingsReferenceCard({
  card,
  onOpenSetting,
}: {
  card: SettingsCardConfig;
  onOpenSetting: (setting: SettingsItemConfig) => void;
}) {
  const Icon = card.icon;

  return (
    <article className="settings-reference-card" style={{ "--settings-tone": card.tone } as CSSProperties}>
      <header>
        <span>
          <Icon size={27} />
        </span>
        <div>
          <strong>{card.title}</strong>
          <em>{card.subtitle}</em>
        </div>
      </header>

      {card.actions ? (
        <div className="settings-reference-actions">
          {card.actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button className="ghost-button" type="button" key={action.label} onClick={action.onClick}>
                <ActionIcon size={18} />
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {card.rows ? (
        <div className="settings-reference-list">
          {card.rows.map((row) => (
            <SettingsReferenceRow row={row} key={row.key} onOpen={() => onOpenSetting(row)} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function SettingsReferenceRow({ row, onOpen }: { row: SettingsItemConfig; onOpen: () => void }) {
  const Icon = row.icon;

  return (
    <button className="settings-reference-row" type="button" onClick={onOpen}>
      <Icon size={20} />
      <span>{row.label}</span>
      <strong className={row.pill ? "settings-value-pill" : undefined}>{row.value}</strong>
      <ChevronRight size={19} />
    </button>
  );
}

function SettingsConfigDialog({
  setting,
  value,
  onChange,
  onClose,
  onSave,
}: {
  setting: SettingsItemConfig;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const DialogIcon = setting.icon;

  return (
    <div className="settings-dialog-backdrop" role="dialog" aria-modal="true" aria-label={`Configurar ${setting.label}`}>
      <button className="settings-dialog-scrim" type="button" aria-label="Fechar configuração" onClick={onClose} />
      <form
        className="settings-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="settings-dialog-head">
          <span>
            <DialogIcon size={22} />
          </span>
          <div>
            <h3>{setting.label}</h3>
            <p>Atualize esta configuração do sistema.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="settings-dialog-field">
          Valor
          {setting.options?.length ? (
            <select value={value} onChange={(event) => onChange(event.target.value)}>
              {setting.options.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input value={value} onChange={(event) => onChange(event.target.value)} />
          )}
        </label>

        <div className="settings-dialog-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" type="submit">
            <Save size={17} />
            Salvar configuração
          </button>
        </div>
      </form>
    </div>
  );
}
function OrderForm({
  clients,
  products,
  draft,
  orderTotal,
  validation,
  onUploadFile,
  onDraftChange,
  onSubmit,
}: {
  clients: Client[];
  products: Product[];
  draft: NewOrderDraft;
  orderTotal: number;
  fractionTotal: number;
  validation: string | null;
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onDraftChange: (draft: NewOrderDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftItems = draft.items ?? [];
  const selectedItems = draftItems
    .map((item) => ({
      item,
      product: products.find((product) => product.id === item.productId),
    }))
    .filter((entry): entry is { item: NewOrderItem; product: Product } => Boolean(entry.product));
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean)));
  const filteredProducts = products.filter((product) => {
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    const query = normalizeText(productSearch);
    const matchesSearch = normalizeText(`${product.name} ${product.sku ?? ""} ${product.category}`).includes(query);
    return matchesCategory && matchesSearch;
  });
  const subtotal = orderTotal;
  const discount = 0;
  const freight = 0;
  const total = subtotal - discount + freight;
  const firstSelectedItem = selectedItems[0];

  function buildPrimaryFractions(product: Product | undefined, quantity: number) {
    if (!product?.allowsFractions) {
      return [];
    }

    return [
      {
        id: "fraction-1",
        quantity,
        color: firstProductColor(product),
        note: "Variação principal",
      },
    ];
  }

  function syncDraft(nextItems: NewOrderItem[], update: Partial<NewOrderDraft> = {}) {
    const firstItem = nextItems[0];
    const firstProduct = products.find((product) => product.id === firstItem?.productId);
    onDraftChange({
      ...draft,
      ...update,
      items: nextItems,
      productId: firstItem?.productId ?? "",
      quantity: firstItem?.quantity ?? 0,
      fractions: firstItem ? buildPrimaryFractions(firstProduct, firstItem.quantity) : [],
      artFileName: firstItem?.artFileName ?? draft.artFileName,
      artFileUrl: firstItem?.artFileUrl ?? draft.artFileUrl,
    });
  }

  function addOrderItem(productId: string) {
    const product = products.find((currentProduct) => currentProduct.id === productId);
    if (!product) {
      return;
    }

    const existingItem = draftItems.find((item) => item.productId === productId);
    if (existingItem) {
      syncDraft(
        draftItems.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                quantity: item.quantity + product.minOrderQty,
              }
            : item,
        ),
      );
      setProductPickerOpen(false);
      return;
    }

    syncDraft([
      ...draftItems,
      {
        id: createClientId("order-item"),
        productId,
        quantity: product.minOrderQty,
        note: "",
        artFileName: "",
        artFileUrl: "",
      },
    ]);
    setProductPickerOpen(false);
  }

  function updateItemQuantity(itemId: string, quantity: number) {
    const itemProduct = selectedItems.find(({ item }) => item.id === itemId)?.product;
    const nextQuantity = Math.max(itemProduct?.minOrderQty ?? 1, quantity || 0);
    syncDraft(
      draftItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: nextQuantity,
            }
          : item,
      ),
    );
  }

  function updateItemNote(itemId: string, note: string) {
    syncDraft(draftItems.map((item) => (item.id === itemId ? { ...item, note } : item)));
  }

  function removeItem(itemId: string) {
    syncDraft(draftItems.filter((item) => item.id !== itemId));
  }

  function clearOrder() {
    syncDraft([]);
    setNoteItemId(null);
  }

  function saveDraft() {
    window.localStorage.setItem("graphflow.orderDraft.manual", JSON.stringify(draft));
    setDraftSaved(true);
    window.setTimeout(() => setDraftSaved(false), 1800);
  }

  async function uploadItemArt(itemId: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const uploaded = await safeUploadFile(onUploadFile, file, "orders");
    if (!uploaded) {
      input.value = "";
      return;
    }

    syncDraft(
      draftItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              artFileName: uploaded.name,
              artFileUrl: uploaded.url,
            }
          : item,
      ),
    );
    input.value = "";
  }

  return (
    <form className="new-order-form" onSubmit={onSubmit}>
      <header className="new-order-page-head">
        <div className="new-order-heading">
          <span className="new-order-back">
            <ChevronLeft size={20} />
          </span>
          <h2>Novo pedido</h2>
          <em>Rascunho</em>
        </div>
        <div className="new-order-header-actions">
          {draftSaved ? <span className="new-order-saved">Rascunho salvo</span> : null}
          <button className="ghost-button" type="button" onClick={saveDraft}>
            Salvar rascunho
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={Boolean(validation) || selectedItems.length === 0}
            data-testid="add-to-cart"
          >
            <Check size={17} />
            Finalizar pedido
          </button>
        </div>
      </header>

      <div className="new-order-body">
        <div className="new-order-main-column">
      <div className="new-order-top-grid">
        <label className="new-order-field">
          <span>Número do pedido</span>
          <input
            value="Gerado ao finalizar"
            readOnly
          />
        </label>

        <label className="new-order-field">
          <span>Data do pedido <b>*</b></span>
          <input
            value={draft.orderDate}
            type="date"
            min={todayInputDate()}
            onChange={(event) => onDraftChange({ ...draft, orderDate: event.target.value })}
          />
        </label>

        <label className="new-order-field new-order-notes-field">
          <span>
            <MessageCircle size={16} />
            Observações (opcional)
          </span>
          <textarea
            maxLength={500}
            value={draft.notes ?? ""}
            placeholder="Adicione observações sobre o pedido..."
            onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })}
          />
          <small>{draft.notes?.length ?? 0}/500</small>
        </label>
      </div>

        <section className="new-order-items-card">
          <div className="new-order-card-title">
            <div>
              <span className="new-order-title-icon">
                <ShoppingBag size={20} />
              </span>
              <div>
                <strong>Itens do pedido</strong>
                <small>Adicione itens ao pedido</small>
              </div>
            </div>
          </div>

          <div className="new-order-items-toolbar">
            <label className="new-order-search">
              <Search size={18} />
              <input
                type="search"
                value={productSearch}
                placeholder="Buscar por nome ou código do item..."
                onChange={(event) => setProductSearch(event.target.value)}
              />
            </label>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Todos os itens</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="new-order-product-table is-order-items">
            <div className="new-order-product-head">
              <span>Item</span>
              <span>Descrição</span>
              <span>Preço unitário</span>
              <span>Quantidade</span>
              <span>Total</span>
              <span>Ações</span>
            </div>
            {selectedItems.map(({ item, product }) => {
              const lineTotal = calculateOrderTotal(product, item.quantity);
              return (
                <div className="new-order-product-row" key={item.id}>
                  <div className="new-order-product-main">
                    <Image
                      src={productDisplayImage(product)}
                      alt={product.name}
                      width={46}
                      height={46}
                      unoptimized
                      onError={(event) => {
                        event.currentTarget.src = quoteProductImage(product);
                      }}
                    />
                    <div>
                      <strong>{product.name}</strong>
                      <small>{product.sku ?? product.id}</small>
                      {item.artFileName ? <em>{item.artFileName}</em> : null}
                    </div>
                  </div>
                  <div className="new-order-product-description">
                    <span>{product.description || product.commercialDescription || product.category}</span>
                    <small>{product.packageDimensionsCm || product.leadTime}</small>
                  </div>
                  <span>
                    {formatCurrency(product.price)}
                    <small>/ {formatNumber(product.minOrderQty)} un</small>
                  </span>
                  <div className="new-order-qty-stepper">
                    <button
                      type="button"
                      onClick={() => updateItemQuantity(item.id, item.quantity - product.minOrderQty)}
                      disabled={item.quantity <= product.minOrderQty}
                      aria-label="Diminuir quantidade"
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      value={item.quantity}
                      type="number"
                      min={product.minOrderQty}
                      onChange={(event) => updateItemQuantity(item.id, Number(event.target.value))}
                    />
                    <button
                      type="button"
                      onClick={() => updateItemQuantity(item.id, item.quantity + product.minOrderQty)}
                      aria-label="Aumentar quantidade"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <strong>{formatCurrency(lineTotal)}</strong>
                  <div className="new-order-line-actions">
                    <label title="Enviar arte">
                      <Paperclip size={16} />
                      <input
                        type="file"
                        onChange={(event) => void uploadItemArt(item.id, event.currentTarget)}
                      />
                    </label>
                    <button type="button" onClick={() => removeItem(item.id)} aria-label="Remover item">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {selectedItems.length === 0 ? (
              <div className="new-order-empty-products">Nenhum item adicionado.</div>
            ) : null}
          </div>

          <button
            className="new-order-add-wide"
            type="button"
            onClick={() => setProductPickerOpen((current) => !current)}
          >
            <Plus size={18} />
            Adicionar item
          </button>

          {productPickerOpen ? (
            <div className="new-order-product-picker">
              {filteredProducts.map((product) => (
                <button type="button" key={product.id} onClick={() => addOrderItem(product.id)}>
                  <Image
                    src={productDisplayImage(product)}
                    alt={product.name}
                    width={42}
                    height={42}
                    unoptimized
                    onError={(event) => {
                      event.currentTarget.src = quoteProductImage(product);
                    }}
                  />
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.sku ?? product.id} · {formatCurrency(product.price)}</small>
                  </span>
                  <Plus size={16} />
                </button>
              ))}
              {filteredProducts.length === 0 ? <span>Nenhum produto encontrado.</span> : null}
            </div>
          ) : null}

          <div className="new-order-pagination">
            <span>
              Mostrando {selectedItems.length} de {selectedItems.length} itens
            </span>
            <div>
              <button className="icon-button" type="button" disabled aria-label="Página anterior">
                <ChevronLeft size={16} />
              </button>
              <button className="orders-page-number" type="button">1</button>
              <button className="icon-button" type="button" disabled aria-label="Próxima página">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
        </div>

        <aside className="new-order-summary-card">
          <div className="new-order-summary-head">
            <div>
              <span className="new-order-title-icon">
                <ClipboardList size={19} />
              </span>
              <strong>Resumo do pedido</strong>
            </div>
            <span>{selectedItems.length} {selectedItems.length === 1 ? "item" : "itens"}</span>
          </div>

          <div className="new-order-summary-table">
            <div className="new-order-summary-table-head">
              <span>Item</span>
              <span>Qtd</span>
              <span>Preço unit.</span>
              <span>Total</span>
            </div>
            {selectedItems.map(({ item, product }) => {
              const lineTotal = calculateOrderTotal(product, item.quantity);
              return (
                <div className="new-order-summary-line" key={item.id}>
                  <div className="new-order-summary-product">
                    <Image
                      src={productDisplayImage(product)}
                      alt={product.name}
                      width={46}
                      height={46}
                      unoptimized
                      onError={(event) => {
                        event.currentTarget.src = quoteProductImage(product);
                      }}
                    />
                    <div>
                      <strong>{product.name}</strong>
                      <small>{product.sku ?? product.id}</small>
                      {item.artFileName ? <em>{item.artFileName}</em> : null}
                    </div>
                  </div>
                  <span>{formatNumber(item.quantity)} un</span>
                  <span>{formatCurrency(product.price)}</span>
                  <strong>{formatCurrency(lineTotal)}</strong>
                </div>
              );
            })}
            {selectedItems.length === 0 ? (
              <div className="new-order-empty-summary">
                <Package size={22} />
                <span>Nenhum item adicionado.</span>
              </div>
            ) : null}
            {firstSelectedItem ? (
              <>
                <button
                  className="new-order-note-toggle"
                  type="button"
                  onClick={() => setNoteItemId(noteItemId === firstSelectedItem.item.id ? null : firstSelectedItem.item.id)}
                >
                  <Plus size={16} />
                  {firstSelectedItem.item.note ? "Editar observação do item" : "Adicionar observação ao item"}
                </button>
                {noteItemId === firstSelectedItem.item.id ? (
                  <textarea
                    className="new-order-item-note"
                    value={firstSelectedItem.item.note}
                    placeholder="Acabamento, cores, referência ou instrução específica..."
                    onChange={(event) => updateItemNote(firstSelectedItem.item.id, event.target.value)}
                  />
                ) : null}
              </>
            ) : null}
          </div>

          <button className="new-order-clear" type="button" onClick={clearOrder} disabled={selectedItems.length === 0}>
            <Trash2 size={16} />
            Limpar pedido
          </button>

          <div className="new-order-financial">
            <strong>Resumo financeiro</strong>
            <span>
              Subtotal
              <b>{formatCurrency(subtotal)}</b>
            </span>
            <span>
              Descontos
              <b>{formatCurrency(discount)}</b>
            </span>
            <span>
              Frete
              <button type="button">Calcular</button>
            </span>
            <div>
              <span>Total estimado</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
          </div>

          <div className="new-order-final-summary">
            <strong>Resumo final</strong>
            <div className="new-order-final-grid">
              <div>
                <span>Estabelecimento</span>
                <p>GraphFlow Matriz</p>
                <small>São Paulo · contato@graphflow.com.br</small>
              </div>
              <label className="new-order-final-client">
                <span>Cliente</span>
                <select
                  data-testid="customer-search"
                  value={draft.customerId}
                  onChange={(event) => onDraftChange({ ...draft, customerId: event.target.value })}
                >
                  <option value="">Selecionar cliente (opcional)</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.company}
                    </option>
                  ))}
                </select>
              </label>
              <div className="new-order-final-products">
                <span>Produtos do pedido</span>
                {selectedItems.length ? (
                  selectedItems.map(({ item, product }) => (
                    <small key={item.id}>
                      {product.name} · {formatNumber(item.quantity)} un · {formatCurrency(calculateOrderTotal(product, item.quantity))}
                    </small>
                  ))
                ) : (
                  <small>Adicione produtos para concluir o resumo.</small>
                )}
              </div>
            </div>
          </div>

          {validation ? <p className="form-error">{validation}</p> : null}
        </aside>
      </div>
    </form>
  );
}
function ClientForm({
  draft,
  onUploadFile,
  onDraftChange,
  onSubmit,
}: {
  draft: ClientDraft;
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onDraftChange: (draft: ClientDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function setPersonType(personType: ClientDraft["personType"]) {
    onDraftChange({
      ...draft,
      personType,
      documentType: personType === "PF" ? "CPF" : "CNPJ",
      company: personType === "PF" ? "" : draft.company,
    });
  }

  return (
    <form className="modal-form client-form" onSubmit={onSubmit}>
      <ModalHeader icon={Users} title="Novo Cliente" subtitle="Cadastro completo para CRM, pedidos e orçamentos." />

      <div className="client-type-toggle" role="group" aria-label="Tipo de cliente">
        <button
          className={draft.personType === "PF" ? "active" : ""}
          type="button"
          onClick={() => setPersonType("PF")}
        >
          CPF
        </button>
        <button
          className={draft.personType === "PJ" ? "active" : ""}
          type="button"
          onClick={() => setPersonType("PJ")}
        >
          CNPJ
        </button>
      </div>

      <div className="form-grid client-form-grid">
        <div className="form-section-title span-3">Dados do cliente</div>
        <label>
          {draft.personType === "PF" ? "Nome completo" : "Responsável / Contato"}
          <input
            value={draft.name}
            required
            onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
          />
        </label>
        <label>
          {draft.personType === "PF" ? "Apelido / identificação" : "Empresa / Razão social"}
          <input
            value={draft.company}
            required={draft.personType === "PJ"}
            onChange={(event) => onDraftChange({ ...draft, company: event.target.value })}
          />
        </label>
        <label>
          {draft.documentType}
          <input
            value={draft.document}
            placeholder={draft.documentType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
            required
            onChange={(event) => onDraftChange({ ...draft, document: event.target.value })}
          />
        </label>
        <label>
          E-mail
          <input
            value={draft.email}
            type="email"
            required
            onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
          />
        </label>
        <label>
          Telefone
          <input
            value={draft.phone}
            required
            onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })}
          />
        </label>
        <label>
          WhatsApp
          <input
            value={draft.whatsapp}
            onChange={(event) => onDraftChange({ ...draft, whatsapp: event.target.value })}
          />
        </label>
        <div className="form-section-title span-3">Endereço</div>
        <label>
          CEP
          <input
            value={draft.addressZip}
            onChange={(event) => onDraftChange({ ...draft, addressZip: event.target.value })}
          />
        </label>
        <label className="span-2">
          Endereço
          <input
            value={draft.addressStreet}
            onChange={(event) => onDraftChange({ ...draft, addressStreet: event.target.value })}
          />
        </label>
        <label>
          Número
          <input
            value={draft.addressNumber}
            onChange={(event) => onDraftChange({ ...draft, addressNumber: event.target.value })}
          />
        </label>
        <label>
          Complemento
          <input
            value={draft.addressComplement}
            onChange={(event) => onDraftChange({ ...draft, addressComplement: event.target.value })}
          />
        </label>
        <label>
          Bairro
          <input
            value={draft.addressDistrict}
            onChange={(event) => onDraftChange({ ...draft, addressDistrict: event.target.value })}
          />
        </label>
        <label>
          Cidade
          <input
            value={draft.addressCity}
            required
            onChange={(event) => onDraftChange({ ...draft, addressCity: event.target.value })}
          />
        </label>
        <label>
          UF
          <input
            value={draft.addressState}
            maxLength={2}
            onChange={(event) => onDraftChange({ ...draft, addressState: event.target.value.toUpperCase() })}
          />
        </label>
        <label className="span-2">
          Imagem / logo do cliente
          <span className="upload-field">
            <Upload size={16} />
            <span>{draft.avatarUrl ? "Imagem enviada" : "Selecionar imagem"}</span>
            <input
              accept="image/*"
              type="file"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await safeUploadFile(onUploadFile, file, "clients");
                if (!uploaded) {
                  input.value = "";
                  return;
                }
                onDraftChange({ ...draft, avatarUrl: uploaded.url });
                input.value = "";
              }}
            />
          </span>
        </label>
        <label className="span-3">
          Observações
          <textarea
            value={draft.notes}
            maxLength={600}
            placeholder="Preferências, condições comerciais, responsáveis, restrições de entrega..."
            onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })}
          />
        </label>
      </div>
      <button className="primary-button wide" type="submit">
        <Save size={18} />
        Salvar Cliente
      </button>
    </form>
  );
}

function UserForm({
  draft,
  sectors,
  onUploadFile,
  onDraftChange,
  onSubmit,
}: {
  draft: UserDraft;
  sectors: Sector[];
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onDraftChange: (draft: UserDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function togglePermission(permission: PermissionKey) {
    onDraftChange({
      ...draft,
      permissions: draft.permissions.includes(permission)
        ? draft.permissions.filter((item) => item !== permission)
        : [...draft.permissions, permission],
    });
  }

  function toggleSector(sectorId: string) {
    onDraftChange({
      ...draft,
      sectorIds: draft.sectorIds.includes(sectorId)
        ? draft.sectorIds.filter((item) => item !== sectorId)
        : [...draft.sectorIds, sectorId],
    });
  }

  return (
    <form className="modal-form user-form" onSubmit={onSubmit}>
      <ModalHeader icon={UserCog} title="Novo Usuario" subtitle="Perfil, permissoes e setores acessiveis." />

      <div className="form-grid client-form-grid">
        <div className="form-section-title span-3">Dados de acesso</div>
        <label>
          Nome
          <input value={draft.name} required onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} />
        </label>
        <label>
          E-mail
          <input
            value={draft.email}
            type="email"
            required
            onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
          />
        </label>
        <label>
          Senha temporaria
          <input
            value={draft.password}
            minLength={8}
            type="password"
            onChange={(event) => onDraftChange({ ...draft, password: event.target.value })}
          />
        </label>
        <label>
          Tipo
          <select
            value={draft.type}
            onChange={(event) => onDraftChange({ ...draft, type: event.target.value as UserAccount["type"] })}
          >
            <option value="OPERATOR">Operador</option>
            <option value="CLIENT">Cliente</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <label>
          Perfil
          <select
            value={draft.role}
            onChange={(event) => onDraftChange({ ...draft, role: event.target.value as UserAccount["role"] })}
          >
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Gerente</option>
            <option value="OPERATOR">Operador</option>
            <option value="FINANCE">Financeiro</option>
            <option value="CLIENT">Cliente</option>
            <option value="VIEWER">Leitura</option>
          </select>
        </label>
        <label>
          Telefone
          <input value={draft.phone} onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })} />
        </label>
        <label>
          Documento
          <input value={draft.document} onChange={(event) => onDraftChange({ ...draft, document: event.target.value })} />
        </label>
        <label className="span-2">
          Foto / imagem
          <span className="upload-field">
            <Upload size={16} />
            <span>{draft.avatarUrl ? "Imagem enviada" : "Selecionar imagem"}</span>
            <input
              accept="image/*"
              type="file"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await safeUploadFile(onUploadFile, file, "users");
                if (!uploaded) {
                  input.value = "";
                  return;
                }
                onDraftChange({ ...draft, avatarUrl: uploaded.url });
                input.value = "";
              }}
            />
          </span>
        </label>

        <div className="form-section-title span-3">Permissoes</div>
        <div className="permission-chip-grid span-3">
          {permissionOptions.map((permission) => (
            <button
              className={`permission-chip ${draft.permissions.includes(permission.key) ? "active" : ""}`}
              type="button"
              key={permission.key}
              onClick={() => togglePermission(permission.key)}
            >
              {draft.permissions.includes(permission.key) ? <Check size={14} /> : <Plus size={14} />}
              {permission.label}
            </button>
          ))}
        </div>

        <div className="form-section-title span-3">Setores acessiveis</div>
        <div className="permission-chip-grid span-3">
          {sectors.map((sector) => (
            <button
              className={`permission-chip sector ${draft.sectorIds.includes(sector.id) ? "active" : ""}`}
              type="button"
              key={sector.id}
              onClick={() => toggleSector(sector.id)}
            >
              {draft.sectorIds.includes(sector.id) ? <Check size={14} /> : <Layers3 size={14} />}
              {sector.name}
            </button>
          ))}
        </div>
      </div>

      <button className="primary-button wide" type="submit">
        <Save size={18} />
        Salvar Usuario
      </button>
    </form>
  );
}

function ProductForm({
  draft,
  inventory,
  sectors,
  machines,
  title,
  subtitle,
  submitLabel,
  onUploadFile,
  onDraftChange,
  onSubmit,
}: {
  draft: ProductDraft;
  inventory: InventoryItem[];
  sectors: Sector[];
  machines: Machine[];
  title: string;
  subtitle: string;
  submitLabel: string;
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onDraftChange: (draft: ProductDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const validation = validateProductFiscalDraft(draft);
  const fiscalDisabled = draft.skipFiscalData;

  function updateFiscal(update: Partial<ProductFiscalData>) {
    onDraftChange({ ...draft, fiscal: { ...draft.fiscal, ...update } });
  }

  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <ModalHeader icon={Package} title={title} subtitle={subtitle} />

      <div className={`nfe-diagnosis ${validation.ready ? "ready" : "blocked"}`}>
        <ShieldCheck size={18} />
        <div>
          <strong>
            {fiscalDisabled
              ? "Cadastro sem dados fiscais"
              : validation.ready
                ? "Cadastro apto para emissao de NF-e"
                : "Cadastro com pendencias - NF-e bloqueada ate correcao"}
          </strong>
          <span>
            {fiscalDisabled
              ? "Os campos fiscais foram desativados e nao serao exigidos neste cadastro."
              : validation.ready
                ? validation.alerts.slice(0, 2).join(" | ") || "Campos fiscais obrigatorios preenchidos."
                : [...validation.missing, ...validation.invalid].slice(0, 3).join(" | ")}
          </span>
        </div>
      </div>

      <div className={`form-grid client-form-grid product-fiscal-form ${fiscalDisabled ? "is-fiscal-disabled" : ""}`}>
        <div className="form-section-title span-3">Identificacao</div>
        <TextField label="Codigo interno / SKU" value={draft.sku} onChange={(sku) => onDraftChange({ ...draft, sku })} />
        <TextField label="Nome" value={draft.name} onChange={(name) => onDraftChange({ ...draft, name, commercialDescription: draft.commercialDescription || name })} />
        <TextField label="Descricao comercial" value={draft.commercialDescription} onChange={(commercialDescription) => onDraftChange({ ...draft, commercialDescription })} />
        <TextField label="GTIN/EAN" value={draft.gtin} placeholder="SEM GTIN" onChange={(gtin) => onDraftChange({ ...draft, gtin })} />
        <TextField label="Marca / Fabricante" value={draft.brand} onChange={(brand) => onDraftChange({ ...draft, brand })} />
        <TextField label="Categoria" value={draft.category} onChange={(category) => onDraftChange({ ...draft, category })} />
        <TextField label="Subgrupo" value={draft.subcategory} onChange={(subcategory) => onDraftChange({ ...draft, subcategory })} />
        <label>
          Setor
          <select value={draft.sector} onChange={(event) => onDraftChange({ ...draft, sector: event.target.value })}>
            {sectors.map((sector) => (
              <option key={sector.id} value={sector.name}>
                {sector.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Máquina (Opcional)
          <select value={draft.machineId} onChange={(event) => onDraftChange({ ...draft, machineId: event.target.value })}>
            <option value="">Nenhuma / Automático</option>
            {machines
              .filter((machine) => machine.sector === draft.sector)
              .map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Imagem do produto
          <span className="upload-field">
            <Upload size={16} />
            <span>{draft.thumbnailUrl ? "Imagem enviada" : "Selecionar imagem"}</span>
            <input
              accept="image/*"
              type="file"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await safeUploadFile(onUploadFile, file, "products");
                if (!uploaded) {
                  input.value = "";
                  return;
                }
                onDraftChange({ ...draft, thumbnailUrl: uploaded.url });
                input.value = "";
              }}
            />
          </span>
        </label>
        <label className="span-2">
          Descricao complementar
          <textarea
            value={draft.complementaryDescription}
            maxLength={500}
            onChange={(event) => onDraftChange({ ...draft, complementaryDescription: event.target.value })}
          />
        </label>

        <div className="form-section-title span-3 product-fiscal-heading">
          <span>Dados fiscais e tributarios</span>
          <label className="product-fiscal-toggle">
            <input
              checked={fiscalDisabled}
              type="checkbox"
              onChange={(event) => onDraftChange({ ...draft, skipFiscalData: event.target.checked })}
            />
            Sem Dados Fiscais
          </label>
        </div>
        <TextField label="NCM (8 digitos)" value={draft.fiscal.ncm} onChange={(ncm) => updateFiscal({ ncm })} disabled={fiscalDisabled} />
        <TextField label="CEST" value={draft.fiscal.cest} onChange={(cest) => updateFiscal({ cest })} disabled={fiscalDisabled} />
        <label>
          Origem
          <select value={draft.fiscal.origin} disabled={fiscalDisabled} onChange={(event) => updateFiscal({ origin: event.target.value })}>
            <option value="0">0 - Nacional</option>
            <option value="1">1 - Importacao direta</option>
            <option value="2">2 - Importada mercado interno</option>
            <option value="3">3 - Nacional acima 40%</option>
            <option value="4">4 - Nacional PPB</option>
            <option value="5">5 - Nacional abaixo 40%</option>
            <option value="6">6 - Importada sem similar</option>
            <option value="7">7 - Nacional acima 70%</option>
            <option value="8">8 - Nacional acima 70% importado</option>
          </select>
        </label>
        <TextField label="CFOP padrao saida" value={draft.fiscal.cfop} onChange={(cfop) => updateFiscal({ cfop })} disabled={fiscalDisabled} />
        <TextField label="CST / CSOSN ICMS" value={draft.fiscal.icmsCstCsosn} onChange={(icmsCstCsosn) => updateFiscal({ icmsCstCsosn })} disabled={fiscalDisabled} />
        <TextField label="CST PIS" value={draft.fiscal.pisCst} onChange={(pisCst) => updateFiscal({ pisCst })} disabled={fiscalDisabled} />
        <TextField label="CST COFINS" value={draft.fiscal.cofinsCst} onChange={(cofinsCst) => updateFiscal({ cofinsCst })} disabled={fiscalDisabled} />
        <TextField label="CST IPI" value={draft.fiscal.ipiCst} onChange={(ipiCst) => updateFiscal({ ipiCst })} disabled={fiscalDisabled} />
        <TextField label="Aliquota ICMS (%)" value={draft.fiscal.icmsRate} onChange={(icmsRate) => updateFiscal({ icmsRate })} disabled={fiscalDisabled} />
        <TextField label="Aliquota PIS (%)" value={draft.fiscal.pisRate} onChange={(pisRate) => updateFiscal({ pisRate })} disabled={fiscalDisabled} />
        <TextField label="Aliquota COFINS (%)" value={draft.fiscal.cofinsRate} onChange={(cofinsRate) => updateFiscal({ cofinsRate })} disabled={fiscalDisabled} />
        <TextField label="Aliquota IPI (%)" value={draft.fiscal.ipiRate} onChange={(ipiRate) => updateFiscal({ ipiRate })} disabled={fiscalDisabled} />
        <label className="span-3">
          Informacoes adicionais fiscais
          <textarea
            value={draft.fiscal.additionalInfo}
            maxLength={600}
            placeholder="Beneficio fiscal, observacao legal ou mensagem exibida na NF-e."
            disabled={fiscalDisabled}
            onChange={(event) => updateFiscal({ additionalInfo: event.target.value })}
          />
        </label>

        <div className="form-section-title span-3">Unidade, medida, precificacao e estoque</div>
        <TextField label="Unidade comercial NF-e" value={draft.commercialUnit} placeholder="UN" onChange={(commercialUnit) => onDraftChange({ ...draft, commercialUnit: commercialUnit.toUpperCase() })} />
        <TextField label="Unidade de estoque" value={draft.stockUnit} placeholder="UN" onChange={(stockUnit) => onDraftChange({ ...draft, stockUnit: stockUnit.toUpperCase() })} />
        <TextField label="Fator de conversao" value={draft.conversionFactor} placeholder="1 CX = 12 UN" onChange={(conversionFactor) => onDraftChange({ ...draft, conversionFactor })} />
        <NumberField label="Preco de venda" value={draft.price} onChange={(price) => onDraftChange({ ...draft, price })} />
        <NumberField label="Preco de custo" value={draft.costPrice} onChange={(costPrice) => onDraftChange({ ...draft, costPrice })} />
        <NumberField label="Markup (%)" value={draft.markupPercent} onChange={(markupPercent) => onDraftChange({ ...draft, markupPercent })} />
        <NumberField label="Preco minimo" value={draft.minSalePrice} onChange={(minSalePrice) => onDraftChange({ ...draft, minSalePrice })} />
        <TextField label="Tabela de precos" value={draft.priceTable} onChange={(priceTable) => onDraftChange({ ...draft, priceTable })} />
        <NumberField label="Estoque atual" value={draft.stockQty} onChange={(stockQty) => onDraftChange({ ...draft, stockQty })} />
        <NumberField label="Estoque minimo" value={draft.stockMin} onChange={(stockMin) => onDraftChange({ ...draft, stockMin })} />
        <label>
          Item de estoque
          <select value={draft.stockItem} onChange={(event) => onDraftChange({ ...draft, stockItem: event.target.value })}>
            {inventory.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <NumberField label="Mínimo pedido" value={draft.minOrderQty} onChange={(minOrderQty) => onDraftChange({ ...draft, minOrderQty })} />
        <NumberField label="Mínimo fração" value={draft.minFractionQty} onChange={(minFractionQty) => onDraftChange({ ...draft, minFractionQty })} />
        <TextField label="Peso liquido (kg)" value={draft.netWeightKg} placeholder="0.500" onChange={(netWeightKg) => onDraftChange({ ...draft, netWeightKg })} />
        <TextField label="Peso bruto (kg)" value={draft.grossWeightKg} placeholder="0.650" onChange={(grossWeightKg) => onDraftChange({ ...draft, grossWeightKg })} />
        <TextField label="Dimensoes CxLxA (cm)" value={draft.packageDimensionsCm} placeholder="30x20x5" onChange={(packageDimensionsCm) => onDraftChange({ ...draft, packageDimensionsCm })} />
        <TextField label="Local de armazenagem" value={draft.storageLocation} onChange={(storageLocation) => onDraftChange({ ...draft, storageLocation })} />

        <div className="form-section-title span-3">Classificacao interna</div>
        <label className="span-2">
          Cores disponíveis
          <input
            value={draft.availableColorsText}
            placeholder="Azul, Verde, Preto, Branco"
            onChange={(event) => onDraftChange({ ...draft, availableColorsText: event.target.value })}
          />
        </label>
        <label className="check-field">
          <input
            checked={draft.allowsFractions}
            type="checkbox"
            onChange={(event) => onDraftChange({ ...draft, allowsFractions: event.target.checked })}
          />
          Permite fracionamento
        </label>
        <label className="check-field">
          <input
            checked={draft.tracksBatch}
            type="checkbox"
            onChange={(event) => onDraftChange({ ...draft, tracksBatch: event.target.checked })}
          />
          Controla lote / validade
        </label>
        <label className="check-field">
          <input
            checked={draft.isResale}
            type="checkbox"
            onChange={(event) => onDraftChange({ ...draft, isResale: event.target.checked })}
          />
          Produto para revenda
        </label>
        <label className="check-field">
          <input
            checked={draft.saleBlocked}
            type="checkbox"
            onChange={(event) => onDraftChange({ ...draft, saleBlocked: event.target.checked })}
          />
          Bloqueado para venda
        </label>
        <label className="span-3">
          Observacoes internas
          <textarea
            value={draft.internalNotes}
            maxLength={800}
            onChange={(event) => onDraftChange({ ...draft, internalNotes: event.target.value })}
          />
        </label>
      </div>
      <button className="primary-button wide" type="submit">
        <Save size={18} />
        {submitLabel}
      </button>
    </form>
  );
}

function MachineForm({
  draft,
  sectors,
  onDraftChange,
  onSubmit,
}: {
  draft: MachineDraft;
  sectors: Sector[];
  onDraftChange: (draft: MachineDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <ModalHeader icon={Cpu} title="Nova Máquina" subtitle="Cadastro do maquinário e custo operacional." />
      <div className="form-grid">
        <TextField label="Nome" value={draft.name} onChange={(name) => onDraftChange({ ...draft, name })} required />
        <label>
          Setor
          <select value={draft.sectorId} onChange={(event) => onDraftChange({ ...draft, sectorId: event.target.value })}>
            {sectors.map((sector) => (
              <option value={sector.id} key={sector.id}>
                {sector.name}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Modelo" value={draft.model} onChange={(model) => onDraftChange({ ...draft, model })} />
        <TextField label="Número de série" value={draft.serialNumber} onChange={(serialNumber) => onDraftChange({ ...draft, serialNumber })} />
        <NumberField label="Capacidade/hora" value={draft.capacityPerHour} onChange={(capacityPerHour) => onDraftChange({ ...draft, capacityPerHour })} />
        <NumberField label="Custo mensal" value={draft.costMonth} onChange={(costMonth) => onDraftChange({ ...draft, costMonth })} />
        <label>
          Próxima manutenção
          <input
            value={draft.nextMaintenanceAt}
            type="date"
            onChange={(event) => onDraftChange({ ...draft, nextMaintenanceAt: event.target.value })}
          />
        </label>
        <label className="span-2">
          Observações
          <textarea
            value={draft.description}
            maxLength={600}
            onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
          />
        </label>
      </div>
      <button className="primary-button wide" type="submit">
        <Save size={18} />
        Salvar Máquina
      </button>
    </form>
  );
}

function MaintenanceForm({
  draft,
  machines,
  users,
  onDraftChange,
  onSubmit,
}: {
  draft: MaintenanceDraft;
  machines: Machine[];
  users: UserAccount[];
  onDraftChange: (draft: MaintenanceDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const responsibleUsers = users.filter((user) => user.type !== "CLIENT");

  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <ModalHeader icon={Wrench} title="Abrir Chamado" subtitle="Manutenção com responsável, prioridade e especificações." />
      <div className="form-grid">
        <label>
          Máquina
          <select value={draft.machineId} onChange={(event) => onDraftChange({ ...draft, machineId: event.target.value })}>
            {machines.map((machine) => (
              <option value={machine.id} key={machine.id}>
                {machine.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsável
          <select value={draft.assignedUserId} onChange={(event) => onDraftChange({ ...draft, assignedUserId: event.target.value })}>
            <option value="">Sem responsável</option>
            {responsibleUsers.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridade
          <select value={draft.priority} onChange={(event) => onDraftChange({ ...draft, priority: event.target.value as MaintenanceDraft["priority"] })}>
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
            <option value="CRITICAL">Crítica</option>
          </select>
        </label>
        <TextField label="Título" value={draft.title} onChange={(title) => onDraftChange({ ...draft, title })} required />
        <label className="span-2">
          Especificações
          <textarea
            value={draft.description}
            required
            maxLength={1200}
            onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
          />
        </label>
        <label className="span-2">
          Observações
          <textarea
            value={draft.observations}
            maxLength={1200}
            onChange={(event) => onDraftChange({ ...draft, observations: event.target.value })}
          />
        </label>
      </div>
      <button className="primary-button wide" type="submit">
        <Wrench size={18} />
        Abrir Chamado
      </button>
    </form>
  );
}

function ExpenseForm({
  draft,
  onDraftChange,
  onSubmit,
}: {
  draft: ExpenseDraft;
  onDraftChange: (draft: ExpenseDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <ModalHeader icon={CreditCard} title="Novo Lançamento" subtitle="Contas a pagar, receber e custos vinculados." />
      <div className="form-grid">
        <TextField label="Descrição" value={draft.label} onChange={(label) => onDraftChange({ ...draft, label })} required />
        <label>
          Tipo
          <select value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value as FinanceEntry["type"] })}>
            <option value="payable">Conta a pagar</option>
            <option value="receivable">Conta a receber</option>
            <option value="cash">Caixa</option>
            <option value="profit">Lucro</option>
            <option value="margin">Margem</option>
          </select>
        </label>
        <NumberField label="Valor" value={draft.value} onChange={(value) => onDraftChange({ ...draft, value })} />
        <TextField label="Vencimento" value={draft.due} onChange={(due) => onDraftChange({ ...draft, due })} required />
        <label>
          Status
          <select value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value as FinanceEntry["status"] })}>
            <option value="Pendente">Pendente</option>
            <option value="Recebido">Recebido</option>
            <option value="Atrasado">Atrasado</option>
            <option value="Projetado">Projetado</option>
          </select>
        </label>
        <TextField label="Categoria" value={draft.category} onChange={(category) => onDraftChange({ ...draft, category })} />
        <label>
          Relacionado a
          <select value={draft.referenceType} onChange={(event) => onDraftChange({ ...draft, referenceType: event.target.value as FinanceEntry["referenceType"] })}>
            <option value="Geral">Geral</option>
            <option value="Pedido">Pedido</option>
            <option value="Produto">Produto</option>
            <option value="Cliente">Cliente</option>
            <option value="Fornecedor">Fornecedor</option>
          </select>
        </label>
        <TextField label="Código relacionado" value={draft.referenceId} onChange={(referenceId) => onDraftChange({ ...draft, referenceId })} />
        <TextField label="Forma de pagamento" value={draft.paymentMethod} onChange={(paymentMethod) => onDraftChange({ ...draft, paymentMethod })} />
        <label className="span-2">
          Observações
          <textarea value={draft.notes} maxLength={600} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} />
        </label>
      </div>
      <button className="primary-button wide" type="submit">
        <Save size={18} />
        Registrar
      </button>
    </form>
  );
}

function FileForm({
  draft,
  onUploadFile,
  onDraftChange,
  onSubmit,
}: {
  draft: FileDraft;
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onDraftChange: (draft: FileDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <ModalHeader icon={Upload} title="Upload de Arquivo" subtitle="Anexo vinculado." />
      <div className="form-grid">
        <TextField label="Nome do arquivo" value={draft.name} onChange={(name) => onDraftChange({ ...draft, name })} required />
        <label>
          Tipo
          <select value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value as FileItem["type"] })}>
            <option value="Arte">Arte</option>
            <option value="Contrato">Contrato</option>
            <option value="Relatório">Relatório</option>
            <option value="Comprovante">Comprovante</option>
          </select>
        </label>
        <TextField label="Vínculo" value={draft.linkedTo} onChange={(linkedTo) => onDraftChange({ ...draft, linkedTo })} required />
        <label>
          Arquivo
          <span className="upload-field">
            <Upload size={16} />
            <span>{draft.url ? "Arquivo enviado" : "Selecionar arquivo"}</span>
            <input
              type="file"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await safeUploadFile(onUploadFile, file, "files");
                if (!uploaded) {
                  input.value = "";
                  return;
                }
                onDraftChange({ ...draft, name: draft.name || uploaded.name, url: uploaded.url });
                input.value = "";
              }}
            />
          </span>
        </label>
        <TextField label="Responsável" value={draft.owner} onChange={(owner) => onDraftChange({ ...draft, owner })} />
        <label className="span-2">
          Observações
          <textarea value={draft.notes} maxLength={600} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} />
        </label>
      </div>
      <button className="primary-button wide" type="submit">
        <Upload size={18} />
        Enviar
      </button>
    </form>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    };

    return entities[char] ?? char;
  });
}

function orderReceiptText(order: Order, artFiles: OrderArtFile[]) {
  const receiptNumber = order.number ?? order.id;
  const lines = [
    `Pedido ${receiptNumber}`,
    `Cliente: ${order.customer}`,
    `Produto: ${order.product}`,
    `Quantidade: ${formatNumber(order.quantity)} un`,
    `Entrega: ${order.delivery}`,
    `Status: ${statusMeta[order.status].label}`,
    `Total: ${formatCurrency(order.total)}`,
  ];

  if (order.responsible) lines.push(`Responsável: ${order.responsible}`);
  if (order.machineId) lines.push(`Máquina: ${order.machineId}`);
  if (artFiles.length) lines.push(`Arquivos de arte: ${artFiles.map((file) => file.name).join(", ")}`);

  return lines.join("\n");
}

function orderReceiptHtml(order: Order, artFiles: OrderArtFile[]) {
  const receiptNumber = escapeHtml(order.number ?? order.id);
  const rows = [
    ["Cliente", order.customer],
    ["Produto", order.product],
    ["Setor", order.sector],
    ["Quantidade", `${formatNumber(order.quantity)} un`],
    ["Entrega", order.delivery],
    ["Prioridade", order.priority],
    ["Responsável", order.responsible || "Não definido"],
    ["Total", formatCurrency(order.total)],
  ];
  const fractionRows = order.fractions
    .map((fraction) => `
      <tr>
        <td>${escapeHtml(formatNumber(fraction.quantity))} un</td>
        <td>${escapeHtml(fraction.color || "Sem cor")}</td>
        <td>${escapeHtml(fraction.note || "Sem observação")}</td>
      </tr>
    `)
    .join("");
  const fileRows = artFiles
    .map((file) => `
      <tr>
        <td>${escapeHtml(file.name)}</td>
        <td>${escapeHtml(file.productName)}</td>
        <td>${escapeHtml(file.size ?? "arquivo")}</td>
      </tr>
    `)
    .join("");

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Pedido ${receiptNumber}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #f7f9fc; color: #0b1020; font-family: Inter, "Google Sans", Arial, sans-serif; }
          main { width: min(820px, calc(100% - 32px)); margin: 24px auto; border: 1px solid #dfe5ef; border-radius: 10px; background: #fff; padding: 28px; }
          header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 1px solid #edf1f7; padding-bottom: 18px; }
          h1 { margin: 0; font-size: 26px; }
          p { margin: 6px 0 0; color: #647087; }
          .status { display: inline-flex; align-items: center; height: 30px; border-radius: 999px; background: ${statusMeta[order.status].bg}; color: ${statusMeta[order.status].color}; padding: 0 12px; font-size: 12px; font-weight: 700; }
          .total { margin-top: 18px; border-radius: 8px; background: #f4f1ff; color: #5b45ff; padding: 18px; text-align: right; }
          .total span { display: block; color: #647087; font-size: 12px; }
          .total strong { display: block; margin-top: 4px; font-size: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border-bottom: 1px solid #edf1f7; padding: 11px 8px; text-align: left; font-size: 13px; vertical-align: top; }
          th { color: #647087; font-size: 12px; }
          .label { color: #647087; width: 170px; }
          @media print {
            body { background: #fff; }
            main { width: 100%; margin: 0; border: 0; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div>
              <h1>Recibo do Pedido ${receiptNumber}</h1>
              <p>GraphFlow · ${escapeHtml(new Date().toLocaleDateString("pt-BR"))}</p>
            </div>
            <span class="status">${escapeHtml(statusMeta[order.status].label)}</span>
          </header>
          <table>
            <tbody>
              ${rows.map(([label, value]) => `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}
            </tbody>
          </table>
          ${order.fractions.length ? `
            <table>
              <thead><tr><th>Fração</th><th>Cor</th><th>Observação</th></tr></thead>
              <tbody>${fractionRows}</tbody>
            </table>
          ` : ""}
          ${artFiles.length ? `
            <table>
              <thead><tr><th>Arquivo</th><th>Vínculo</th><th>Tamanho</th></tr></thead>
              <tbody>${fileRows}</tbody>
            </table>
          ` : ""}
          <div class="total">
            <span>Total do pedido</span>
            <strong>${escapeHtml(formatCurrency(order.total))}</strong>
          </div>
        </main>
        <script>
          window.addEventListener("load", () => setTimeout(() => window.print(), 150));
        </script>
      </body>
    </html>`;
}

type DocumentDetailTab = "summary" | "items" | "payments" | "log";

type DocumentDetailTabItem = {
  id: DocumentDetailTab;
  label: string;
};

function DetailTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: DocumentDetailTabItem[];
  activeTab: DocumentDetailTab;
  onChange: (tab: DocumentDetailTab) => void;
}) {
  return (
    <nav className="document-detail-tabs" aria-label="Seções do documento">
      {tabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "active" : ""}
          type="button"
          key={tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function paymentFinanceStatus(status: PaymentStatus): FinanceEntry["status"] {
  if (status === "PAID") return "Recebido";
  if (status === "FAILED" || status === "CANCELED" || status === "REFUNDED") return "Atrasado";
  return "Pendente";
}

function paymentTransactionToFinanceEntry(payment: PaymentTransactionRecord): FinanceEntry {
  const referenceId = payment.orderId ?? payment.quoteId ?? payment.purchaseOrderId ?? payment.financeId ?? "";
  const labelFromMetadata = typeof payment.metadata?.label === "string" ? payment.metadata.label : "";
  const notesFromMetadata = typeof payment.metadata?.notes === "string" ? payment.metadata.notes : "";
  const date = (payment.paidAt ?? payment.dueAt ?? payment.createdAt ?? "").slice(0, 10);

  return {
    id: payment.id,
    label: labelFromMetadata || `Pagamento ${referenceId}`,
    type: payment.direction === "incoming" ? "receivable" : "payable",
    value: Number(payment.amount) || 0,
    due: date ? formatDateShort(date) : "",
    status: paymentFinanceStatus(payment.status),
    category: "Pagamentos",
    referenceType: payment.orderId ? "Pedido" : payment.purchaseOrderId ? "Fornecedor" : "Geral",
    referenceId,
    paymentMethod: paymentMethodLabels[payment.method] ?? payment.method,
    notes: [notesFromMetadata, payment.providerReference].filter(Boolean).join(" - "),
  };
}

function paymentEntriesFromTransactions(payments: PaymentTransactionRecord[]) {
  return payments.map(paymentTransactionToFinanceEntry);
}

function documentPaymentEntries(finance: FinanceEntry[], references: Array<string | undefined>) {
  const normalizedReferences = references.filter(Boolean).map((reference) => normalizeText(reference ?? ""));

  return finance.filter((entry) => {
    const reference = normalizeText(`${entry.referenceId ?? ""} ${entry.label} ${entry.notes ?? ""}`);
    return normalizedReferences.some((item) => item && reference.includes(item));
  });
}

function paidAmountFrom(entries: FinanceEntry[]) {
  return entries
    .filter((entry) => entry.status === "Recebido")
    .reduce((sum, entry) => sum + entry.value, 0);
}

function paymentSummaryForOrder(order: Order, finance: FinanceEntry[]) {
  const entries = documentPaymentEntries(finance, [order.id, order.publicOrderId, order.number]);
  const paidFromEntries = paidAmountFrom(entries);
  const paidAmount = Math.max(order.paidAmount ?? 0, paidFromEntries);
  const remainingAmount = Math.max(0, order.total - paidAmount);
  const status =
    order.paymentStatus ??
    (remainingAmount <= 0 && order.total > 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING");

  return {
    entries,
    paidAmount,
    remainingAmount,
    status,
  };
}

function DocumentFinanceSummary({
  subtotal,
  paymentEntries,
  label = "Adicionar pagamento",
  onAddPayment,
}: {
  subtotal: number;
  paymentEntries: FinanceEntry[];
  label?: string;
  onAddPayment?: (input: OrderPaymentInput) => void | Promise<void>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const paidAmount = paidAmountFrom(paymentEntries);
  const pendingAmount = Math.max(0, subtotal - paidAmount);
  const [amount, setAmount] = useState(pendingAmount);
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [status, setStatus] = useState<OrderPaymentInput["status"]>("PAID");
  const [date, setDate] = useState(todayInputDate());
  const [providerReference, setProviderReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canSubmit = Boolean(onAddPayment) && amount > 0 && amount <= pendingAmount + 0.009 && !isSaving;

  useEffect(() => {
    if (!isAdding) {
      setAmount(pendingAmount);
      setDate(todayInputDate());
    }
  }, [isAdding, pendingAmount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onAddPayment || !canSubmit) return;

    setIsSaving(true);
    try {
      await onAddPayment({
        amount,
        method,
        status,
        date,
        providerReference,
        notes,
      });
      setIsAdding(false);
      setProviderReference("");
      setNotes("");
    } catch {
      // A notificacao de erro e emitida pelo handler do pedido.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside className="document-finance-card">
      <h3>Resumo financeiro</h3>
      <div className="finance-summary-line">
        <span>Subtotal</span>
        <strong>{formatCurrency(subtotal)}</strong>
      </div>
      <div className="finance-summary-line">
        <span>Descontos</span>
        <strong>{formatCurrency(0)}</strong>
      </div>
      <div className="finance-summary-line">
        <span>Pagamentos</span>
        <strong>{formatCurrency(paidAmount)}</strong>
      </div>
      <div className="document-finance-balance">
        <span>Saldo devedor</span>
        <strong>{formatCurrency(pendingAmount)}</strong>
      </div>
      {isAdding ? (
        <form
          className="document-finance-add"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <NumberField label="Valor" value={amount} onChange={setAmount} />
          <label>
            Método
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="Pix">Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Boleto">Boleto</option>
            </select>
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="ghost-button compact wide" type="button" onClick={() => setIsAdding(false)}>
              Cancelar
            </button>
            <button className="primary-button compact wide" type="submit" disabled={!onAddPayment || amount <= 0}>
              Salvar
            </button>
          </div>
        </form>
      ) : (
        <button className="primary-button compact blue-button" style={{ width: "100%", padding: "12px", justifyContent: "center" }} type="button" onClick={() => { setAmount(pendingAmount); setIsAdding(true); }} disabled={pendingAmount <= 0 || !onAddPayment}>
          <CircleDollarSign size={16} />
          {label}
        </button>
      )}
    </aside>
  );
}

function PaymentsPanel({ entries }: { entries: FinanceEntry[] }) {
  if (!entries.length) {
    return (
      <div className="document-empty-panel">
        <CircleDollarSign size={30} />
        <strong>Nenhum pagamento vinculado.</strong>
        <span>Os lançamentos financeiros aparecerão aqui quando forem associados ao documento.</span>
      </div>
    );
  }

  return (
    <div className="document-payments-list">
      {entries.map((entry) => (
        <article key={entry.id}>
          <span className={entry.status === "Recebido" ? "positive" : "warning"}>{entry.status}</span>
          <div>
            <strong>{entry.label}</strong>
            <small>{entry.due ? `Vencimento: ${entry.due}` : "Sem vencimento"}</small>
          </div>
          <strong>{formatCurrency(entry.value)}</strong>
        </article>
      ))}
    </div>
  );
}

function LogPanel({ entries }: { entries: Array<{ title: string; detail: string; time: string }> }) {
  return (
    <div className="document-log-list">
      {entries.map((entry) => (
        <article key={`${entry.title}-${entry.time}`}>
          <span />
          <div>
            <strong>{entry.title}</strong>
            <small>{entry.detail}</small>
          </div>
          <time>{entry.time}</time>
        </article>
      ))}
    </div>
  );
}

function OrderDetail({
  order,
  clients,
  finance,
  files,
  products,
  machines,
  sectors,
  users,
  onUploadFile,
  onSave,
  onAddArtFile,
  onAddPayment,
}: {
  order: Order;
  clients: Client[];
  finance: FinanceEntry[];
  files: FileItem[];
  products: Product[];
  machines: Machine[];
  sectors: Sector[];
  users: UserAccount[];
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onSave: (orderId: string, update: OrderEditDraft & { clientEmail?: string; clientPhone?: string; clientDocument?: string }) => void | Promise<void>;
  onAddArtFile: (order: Order, input: { productName: string; name: string; url: string }) => void | Promise<void>;
  onAddPayment?: (amount: number, method: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<OrderEditDraft & { clientEmail: string; clientPhone: string; clientDocument: string }>({
    id: order.id,
    customer: order.customer,
    productId: order.productId,
    sector: order.sector,
    quantity: order.quantity,
    status: order.status,
    progress: order.progress,
    delivery: order.dueDate || order.delivery,
    priority: order.priority,
    machineId: order.machineId ?? "",
    responsible: order.responsible ?? "",
    clientEmail: "",
    clientPhone: "",
    clientDocument: "",
  });
  const [artDraft, setArtDraft] = useState({ productName: order.product, name: "", url: "" });
  const linkedFiles = files.filter((file) => {
    const haystack = normalizeText(`${file.linkedTo ?? ""} ${file.name}`);
    const orderNum = normalizeText(order.number ?? order.id);
    const orderId  = normalizeText(order.id);
    return haystack.includes(orderNum) || haystack.includes(orderId);
  });

  // Todos os arquivos do pedido — com ou sem URL
  const allOrderFiles = [
    ...(order.artFiles ?? []).map((f) => ({
      id: f.id,
      productName: f.productName ?? "",
      name: f.name,
      url: f.url && f.url !== "#" ? f.url : "",
      size: f.size ?? "",
    })),
    ...linkedFiles.map((file) => ({
      id: file.id,
      productName: file.linkedTo ?? "",
      name: file.name,
      url: file.url ?? "",
      size: file.size ?? "",
    })),
  ];

  // Remove duplicatas pelo nome
  const seen = new Set<string>();
  const artFiles = allOrderFiles.filter((f) => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  });
  const [shareFeedback, setShareFeedback] = useState("");
  const receiptNumber = order.number ?? order.id;
  const [activeTab, setActiveTab] = useState<DocumentDetailTab>("summary");
  const client = clients.find(
    (item) => item.id === order.customer || item.name === order.customer || item.company === order.customer,
  );
  const paymentEntries = documentPaymentEntries(finance, [order.id, order.publicOrderId, order.number]);
  const publicLink = publicOrderLink(order);
  const orderLogEntries = [
    { title: "Pedido criado", detail: `Registro ${receiptNumber} iniciado no sistema.`, time: order.delivery || "Hoje" },
    { title: "Status atualizado", detail: statusMeta[order.status].label, time: `${order.progress}%` },
    { title: "Produção", detail: `${order.sector} ${order.machineId ? `• ${order.machineId}` : ""}`, time: order.responsible || "Equipe" },
    ...(order.publicLinkAcceptedAt
      ? [{ title: "Link aceito", detail: "Cliente confirmou o pedido pelo link público.", time: order.publicLinkAcceptedAt }]
      : []),
  ];

  function handlePrintReceipt() {
    const receiptWindow = window.open("", "_blank", "width=920,height=760");

    if (!receiptWindow) {
      setShareFeedback("Permita pop-ups para gerar o PDF do pedido.");
      return;
    }

    receiptWindow.opener = null;
    receiptWindow.document.open();
    receiptWindow.document.write(orderReceiptHtml(order, artFiles));
    receiptWindow.document.close();
    receiptWindow.focus();
  }

  async function handleShareReceipt() {
    const text = orderReceiptText(order, artFiles);
    const title = `Pedido ${receiptNumber}`;

    try {
      if ("share" in navigator && typeof navigator.share === "function") {
        await navigator.share({ title, text });
        setShareFeedback("Pedido compartilhado.");
        return;
      }

      await navigator.clipboard?.writeText(text);
      setShareFeedback("Resumo do pedido copiado.");
    } catch {
      setShareFeedback("Não foi possível compartilhar agora.");
    }
  }

  return (
    <div className="modal-form order-detail">
      <ModalHeader icon={ClipboardList} title={`Pedido ${order.number ?? order.id}`}>
        <div className="order-detail-header-status">
          <StatusPill status={order.status} />
        </div>
      </ModalHeader>
      
      <section className="document-client-bar-new">
        <div className="client-bar-card">
          <div className="client-bar-icon"><User size={20} /></div>
          <div className="client-bar-info">
            <span>Cliente</span>
            <strong>{client?.company ?? order.customer}</strong>
          </div>
        </div>
        <div className="client-bar-card">
          <div className="client-bar-icon"><CalendarDays size={20} /></div>
          <div className="client-bar-info">
            <span>Entrega</span>
            <strong>{order.delivery}</strong>
          </div>
        </div>
        <div className="client-bar-card">
          <div className="client-bar-icon"><Phone size={20} /></div>
          <div className="client-bar-info">
            <span>Telefone</span>
            <strong>{client?.phone || client?.whatsapp || "Não informado"}</strong>
          </div>
        </div>
        <div className="client-bar-card">
          <div className="client-bar-icon"><Mail size={20} /></div>
          <div className="client-bar-info">
            <span>E-mail</span>
            <strong>{client?.email || "Não informado"}</strong>
          </div>
        </div>
      </section>

      <DetailTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "summary", label: "Resumo" },
          { id: "items", label: "Itens do Pedido" },
          { id: "payments", label: "Pagamentos" },
          { id: "log", label: "Log de acompanhamento" },
        ]}
      />

      <div className="document-detail-layout">
        <div className="document-detail-main">
          {activeTab === "summary" ? (
            <>
      <div className="order-items-section">
        <div className="order-items-top">
          <h3>Itens do pedido</h3>
          <div className="order-receipt-actions">
            <button className="ghost-button compact" type="button" onClick={handlePrintReceipt}>
              <Download size={16} />
              PDF
            </button>
            <button className="primary-button compact blue-button" type="button" onClick={() => void handleShareReceipt()}>
              <Send size={16} />
              Compartilhar
            </button>
          </div>
        </div>

        <div className="order-items-table">
          <div className="order-items-thead">
            <span>Produto</span>
            <span>Quantidade</span>
            <span>Setor</span>
            <span>Valor unitário</span>
            <span>Total</span>
            <span>Arquivo</span>
          </div>
          <div className="order-items-tbody">
            {(order.items && order.items.length > 0 ? order.items : [{
              id: order.itemId ?? order.id,
              productId: order.productId,
              productName: order.product,
              description: order.product,
              quantity: order.quantity,
              unitPrice: order.total / Math.max(1, order.quantity),
              total: order.total,
              sector: order.sector,
            }]).map((item, itemIndex, itemList) => {
              // Arquivos por nome de produto
              const byName = artFiles.filter(
                (f) => normalizeText(f.productName).includes(normalizeText(item.productName || item.description)) ||
                       normalizeText(item.productName || item.description).includes(normalizeText(f.productName))
              );
              // Se não achou por nome mas é item único, pega todos
              const allItemFiles = byName.length > 0
                ? byName
                : itemList.length === 1
                  ? artFiles
                  : [];
              return (
                <div className="order-items-row" key={item.id}>
                  <div className="order-item-product">
                    <div className="order-item-thumb">
                      <Package size={24} color="#9ca3af" />
                    </div>
                    <span>{item.productName || item.description}</span>
                  </div>
                  <span className="order-item-qty">{formatNumber(item.quantity)} un</span>
                  <span className="order-item-sector">{item.sector}</span>
                  <span className="order-item-unit-price">{formatCurrency(item.unitPrice || (item.total / Math.max(1, item.quantity)))}</span>
                  <strong className="order-item-total">{formatCurrency(item.total)}</strong>
                  <div className="order-item-files">
                    {allItemFiles.map((file) => (
                      <button
                        key={file.id}
                        className="ghost-button compact"
                        type="button"
                        title={file.url ? `Baixar ${file.name}` : `${file.name} (sem URL)`}
                        disabled={!file.url}
                        onClick={() => {
                          if (!file.url) return;
                          const a = document.createElement("a");
                          a.href = file.url;
                          a.download = file.name;
                          a.target = "_blank";
                          a.rel = "noopener noreferrer";
                          a.click();
                        }}
                        style={{ maxWidth: 150, opacity: file.url ? 1 : 0.5 }}
                      >
                        <Download size={13} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                          {file.name}
                        </span>
                      </button>
                    ))}
                    <label
                      className="ghost-button compact"
                      title="Enviar arquivo para este item"
                      style={{ cursor: "pointer", flexShrink: 0 }}
                    >
                      <Upload size={13} />
                      {allItemFiles.length === 0 ? "Enviar" : ""}
                      <input
                        type="file"
                        style={{ display: "none" }}
                        accept="image/*,application/pdf,.zip"
                        onChange={async (e) => {
                          const file = e.currentTarget.files?.[0];
                          if (!file) return;
                          const uploaded = await safeUploadFile(onUploadFile, file, "orders");
                          if (!uploaded) { if (e.currentTarget) e.currentTarget.value = ""; return; }
                          await onAddArtFile(order, {
                            productName: item.productName || item.description,
                            name: uploaded.name,
                            url: uploaded.url,
                          });
                          if (e.currentTarget) e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="order-items-tfoot">
            <span>Total do pedido</span>
            <strong>{formatCurrency(order.total)}</strong>
          </div>
        </div>
      </div>

      <div className="order-details-section">
        <h3>Detalhes do pedido</h3>
        <div className="order-details-grid">
          <div className="order-detail-info">
            <ClipboardList size={20} color="#9ca3af" />
            <div>
              <span>ID do pedido</span>
              <strong>{receiptNumber}</strong>
            </div>
          </div>
          <div className="order-detail-info">
            <FileText size={20} color="#9ca3af" />
            <div>
              <span>Documento</span>
              <strong>{client?.document || "00000000000"}</strong>
            </div>
          </div>
          <div className="order-detail-info">
            <ArrowUpRight size={20} color="#9ca3af" />
            <div>
              <span>Prioridade</span>
              <strong>{order.priority}</strong>
            </div>
          </div>
          <div className="order-detail-info">
            <Settings size={20} color="#9ca3af" />
            <div>
              <span>Status</span>
              <StatusPill status={order.status} />
            </div>
          </div>
          <div className="order-detail-info">
            <Clock3 size={20} color="#9ca3af" />
            <div>
              <span>Criado em</span>
              <strong>{order.createdAt || "Hoje"} {order.time ? ` ${order.time}` : ""}</strong>
            </div>
          </div>
          <div className="order-detail-info">
            <RefreshCw size={20} color="#9ca3af" />
            <div>
              <span>Atualizado em</span>
              <strong>{order.createdAt || "Hoje"} {order.time ? ` ${order.time}` : ""}</strong>
            </div>
          </div>
        </div>
      </div>
      {order.fractions.length ? (
        <div className="order-detail-fractions">
          <strong>Frações</strong>
          {order.fractions.map((fraction) => (
            <span key={fraction.id}>
              {formatNumber(fraction.quantity)} un · {fraction.color || "Sem cor"} {fraction.note ? `· ${fraction.note}` : ""}
            </span>
          ))}
        </div>
      ) : null}

            </>
          ) : null}

          {activeTab === "items" ? (
            <>

      <form
        className="advanced-order-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(order.id, draft);
        }}
      >
        <div className="form-section-title">Edição avançada</div>
        <div className="form-grid">
          <TextField label="Cliente no pedido" value={draft.customer} onChange={(customer) => setDraft({ ...draft, customer })} required />
          <TextField label="E-mail no pedido" value={draft.clientEmail} onChange={(clientEmail) => setDraft({ ...draft, clientEmail })} />
          <TextField label="Telefone no pedido" value={draft.clientPhone} onChange={(clientPhone) => setDraft({ ...draft, clientPhone })} />
          <TextField label="Documento no pedido" value={draft.clientDocument} onChange={(clientDocument) => setDraft({ ...draft, clientDocument })} />
          <label>
            Produto
            <select value={draft.productId} onChange={(event) => setDraft({ ...draft, productId: event.target.value })}>
              {products.map((product) => (
                <option value={product.id} key={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as OrderStatus })}>
              {(Object.keys(statusMeta) as OrderStatus[]).map((status) => (
                <option value={status} key={status}>
                  {statusMeta[status].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Setor
            <select value={draft.sector} onChange={(event) => setDraft({ ...draft, sector: event.target.value })}>
              {sectors.map((sector) => (
                <option value={sector.name} key={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Máquina
            <select value={draft.machineId} onChange={(event) => setDraft({ ...draft, machineId: event.target.value })}>
              <option value="">Sem máquina</option>
              {machines.map((machine) => (
                <option value={machine.id} key={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsável
            <select value={draft.responsible} onChange={(event) => setDraft({ ...draft, responsible: event.target.value })}>
              <option value="">Sem responsável</option>
              {users.filter((user) => user.type !== "CLIENT").map((user) => (
                <option value={user.name} key={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <NumberField label="Quantidade" value={draft.quantity} onChange={(quantity) => setDraft({ ...draft, quantity })} />
        </div>
        <button className="primary-button wide" type="submit">
          <Save size={18} />
          Salvar Pedido
        </button>
      </form>

      <div className="order-art-panel">
        <div className="form-section-title">Arquivos de arte por item</div>
        {artFiles.length ? (
          <div className="file-list compact">
            {artFiles.map((file) => (
              <article className="file-row" key={file.id}>
                <span className="file-icon"><FileText size={18} /></span>
                <div>
                  <strong>{file.name}</strong>
                  <span>{file.productName}</span>
                </div>
                <span>{file.size ?? "arquivo"}</span>
                <button className="icon-button" type="button" title="Download" onClick={() => file.url && window.open(file.url, "_blank", "noopener,noreferrer")}>
                  <Download size={16} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Nenhuma arte vinculada a este pedido.</p>
        )}
        <form
          className="inline-edit-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void onAddArtFile(order, artDraft);
            setArtDraft({ ...artDraft, name: "", url: "" });
          }}
        >
          <select value={artDraft.productName} onChange={(event) => setArtDraft({ ...artDraft, productName: event.target.value })}>
            <option value={order.product}>{order.product}</option>
            {products.map((product) => (
              <option value={product.name} key={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <input value={artDraft.name} placeholder="Nome da arte" onChange={(event) => setArtDraft({ ...artDraft, name: event.target.value })} />
          <label className="upload-field inline-upload">
            <Upload size={15} />
            <span>{artDraft.url ? "Arte enviada" : "Enviar arte"}</span>
            <input
              type="file"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await safeUploadFile(onUploadFile, file, "orders");
                if (!uploaded) {
                  input.value = "";
                  return;
                }
                setArtDraft({ ...artDraft, name: artDraft.name || uploaded.name, url: uploaded.url });
                input.value = "";
              }}
            />
          </label>
          <button className="ghost-button compact" type="submit">
            <Upload size={15} />
            Anexar
          </button>
        </form>
      </div>
            </>
          ) : null}

          {activeTab === "payments" ? <PaymentsPanel entries={paymentEntries} /> : null}
          {activeTab === "log" ? <LogPanel entries={orderLogEntries} /> : null}
        </div>

        <DocumentFinanceSummary subtotal={order.total} paymentEntries={paymentEntries} onAddPayment={onAddPayment} />
      </div>
    </div>
  );
}

function QuoteDetail({
  quote,
  clients,
  finance,
  onConvert,
}: {
  quote: Quote;
  clients: Client[];
  finance: FinanceEntry[];
  onConvert?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DocumentDetailTab>("summary");
  const client = clients.find((item) => item.id === quote.customerId);
  const total = quoteTotal(quote);
  const publicLink = publicQuoteLink(quote);
  const paymentEntries = documentPaymentEntries(finance, [quote.id, quote.publicQuoteId]);
  const quoteLogEntries = [
    { title: "Orçamento criado", detail: `Proposta ${quote.id} registrada no sistema.`, time: quote.createdAt || "Hoje" },
    { title: "Validade definida", detail: `Válido até ${formatDateShort(quote.validUntil)}`, time: quote.status },
    ...(publicLink ? [{ title: "Link público gerado", detail: "Cliente pode visualizar e aceitar a proposta.", time: "Ativo" }] : []),
    ...(quote.acceptedAt ? [{ title: "Orçamento aceito", detail: "Cliente confirmou a proposta pelo link público.", time: quote.acceptedAt }] : []),
  ];

  return (
    <div className="modal-form quote-detail document-detail">
      <ModalHeader icon={FileText} title={`Orçamento ${quote.id}`} subtitle="Detalhes comerciais, itens, pagamentos e acompanhamento." />

      <section className="document-client-bar">
        <div>
          <span>ID</span>
          <strong>{quote.id}</strong>
        </div>
        <div>
          <span>Cliente</span>
          <strong>{client?.company ?? quote.customerName}</strong>
        </div>
        <div>
          <span>Documento</span>
          <strong>{client?.document || "Não informado"}</strong>
        </div>
        <div>
          <span>Telefone</span>
          <strong>{client?.phone || client?.whatsapp || "Não informado"}</strong>
        </div>
        <div>
          <span>E-mail</span>
          <strong>{quote.customerEmail || client?.email || "Não informado"}</strong>
        </div>
        <div className="document-client-actions">
          {onConvert ? (
            <button className="icon-button" type="button" title="Converter em Pedido" onClick={onConvert}>
              <ClipboardList size={16} />
            </button>
          ) : null}
          <button className="icon-button" type="button" title="Enviar e-mail" disabled={!quote.customerEmail && !client?.email}>
            <Mail size={16} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Copiar link público"
            disabled={!publicLink}
            onClick={() => publicLink && void navigator.clipboard?.writeText(publicLink)}
          >
            <Link2 size={16} />
          </button>
          {publicLink ? (
            <a className="icon-button" href={publicLink} target="_blank" rel="noreferrer" title="Abrir link público">
              <ArrowUpRight size={16} />
            </a>
          ) : null}
        </div>
      </section>

      <DetailTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "summary", label: "Resumo" },
          { id: "items", label: "Itens do Orçamento" },
          { id: "payments", label: "Pagamentos" },
          { id: "log", label: "Log de acompanhamento" },
        ]}
      />

      <div className="document-detail-layout">
        <div className="document-detail-main">
          {activeTab === "summary" ? (
            <section className="document-summary-panel">
              <div className="document-summary-head">
                <div>
                  <span>Status</span>
                  <strong>{quote.status}</strong>
                </div>
                <div>
                  <span>Data</span>
                  <strong>{quote.createdAt || "Não informado"}</strong>
                </div>
                <div>
                  <span>Validade</span>
                  <strong>{formatDateShort(quote.validUntil)}</strong>
                </div>
                <div>
                  <span>Vendedor</span>
                  <strong>{quote.responsible || "Equipe comercial"}</strong>
                </div>
              </div>

              <div className="document-delivery-box">
                <MapPin size={20} />
                <div>
                  <strong>Observações</strong>
                  <p>{quote.notes || "Sem observações cadastradas para este orçamento."}</p>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "items" ? (
            <section className="document-items-panel">
              <div className="document-table head">
                <span>Produto / Serviço</span>
                <span>Qtd.</span>
                <span>Valor Unit.</span>
                <span>Total</span>
              </div>
              {quote.items.map((item) => (
                <div className="document-table" key={item.id}>
                  <strong>{item.productName}</strong>
                  <span>{formatNumber(item.quantity)}</span>
                  <span>{formatCurrency(item.unitPrice)}</span>
                  <strong>{formatCurrency(item.total)}</strong>
                </div>
              ))}
            </section>
          ) : null}

          {activeTab === "payments" ? <PaymentsPanel entries={paymentEntries} /> : null}
          {activeTab === "log" ? <LogPanel entries={quoteLogEntries} /> : null}
        </div>

        <DocumentFinanceSummary subtotal={total} paymentEntries={paymentEntries} />
      </div>
    </div>
  );
}

function BrandBlock({ compact }: { compact: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <Image
        src={GRAPHFLOW_LOGO_SRC}
        alt="GraficFlow"
        width={compact ? 300 : 220}
        height={compact ? 80 : 64}
        className={compact ? "brand-logo-compact" : "brand-logo-image"}
        style={{ width: "100%", height: "auto", objectFit: "contain" }}
        priority
      />
      <div>
        <strong>GraphFlow</strong>
        <span>painel da gráfica</span>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  tone,
  Icon,
  data,
}: {
  title: string;
  value: string;
  detail: string;
  tone: string;
  Icon: LucideIcon;
  data: number[];
}) {
  return (
    <article className="metric-card">
      <div className="metric-head">
        <div>
          <span>{title}</span>
          <strong>{value}</strong>
          <small className={detail.startsWith("+") ? "positive" : ""}>{detail}</small>
        </div>
        <div className="metric-icon" style={{ "--tone": tone } as CSSProperties}>
          <Icon size={24} />
        </div>
      </div>
      <Sparkline data={data} color={tone} />
    </article>
  );
}

function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`section-card ${className}`}>
      <div className="section-card-head">
        <h2>{title}</h2>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </article>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = pointsFromData(data, 214, 54);

  return (
    <svg className="sparkline" viewBox="0 0 214 54" role="img" aria-label="Tendência">
      <polyline fill="none" stroke={color} strokeLinecap="round" strokeWidth="3" points={points} />
    </svg>
  );
}

function AreaChart({
  data,
  color,
  compact = false,
}: {
  data: number[];
  color: string;
  compact?: boolean;
}) {
  const width = 420;
  const height = compact ? 136 : 190;
  const chartData = chartSeries(data);
  const linePoints = pointsFromData(chartData, width, height - 24);
  const areaPoints = `0,${height} ${linePoints} ${width},${height}`;
  const pointPairs = linePoints.split(" ").filter(Boolean);
  const gradientId = `chart-${compact ? "compact" : "full"}-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg className={`area-chart ${compact ? "compact" : ""}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de área">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.24" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.2, 0.45, 0.7].map((position) => (
        <line key={position} x1="0" x2={width} y1={height * position} y2={height * position} stroke="currentColor" strokeOpacity="0.08" />
      ))}
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2" points={linePoints} />
      {pointPairs.map((point, index) => {
        const [x, y] = point.split(",").map(Number);
        return <circle cx={x} cy={y} fill="var(--panel)" key={`${point}-${index}`} r="4" stroke={color} strokeWidth="2" />;
      })}
    </svg>
  );
}

function StatusDonut({ orders }: { orders: Order[] }) {
  const counts = orderStatusCounts(orders);
  const rawTotal = counts.reduce((sum, item) => sum + item.count, 0);
  const total = Math.max(rawTotal, 1);
  let start = 0;
  const gradient = rawTotal
    ? counts
        .map((item) => {
          const percent = (item.count / total) * 100;
          const segment = `${statusMeta[item.status].color} ${start}% ${start + percent}%`;
          start += percent;
          return segment;
        })
        .join(", ")
    : "var(--line-soft) 0% 100%";

  return (
    <div className="status-donut-layout">
      <div className="donut" style={{ background: `conic-gradient(${gradient})` }}>
        <span />
      </div>
      <div className="status-list">
        {counts.map((item) => (
          <div key={item.status}>
            <i style={{ background: statusMeta[item.status].color }} />
            <span>{statusMeta[item.status].label}</span>
            <strong>
              {item.count} ({Math.round((item.count / total) * 100)}%)
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductionMiniTable({ orders }: { orders: Order[] }) {
  return (
    <div className="mini-table production-mini-table">
      <div className="mini-table-head">
        <span>Pedido</span>
        <span>Produto</span>
        <span>Setor</span>
        <span>Progresso</span>
        <span>Entrega</span>
      </div>
      {orders.map((order) => (
        <div className="mini-table-row" key={order.id}>
          <strong>{order.number ?? order.id}</strong>
          <span>{order.product}</span>
          <span>{order.sector}</span>
          <ProgressBar value={order.progress} color={order.progress < 45 ? "#ff7a00" : "#16b981"} />
          <span>{order.delivery}</span>
        </div>
      ))}
    </div>
  );
}

function NotificationPreview({ notifications }: { notifications: NotificationItem[] }) {
  return (
    <div className="notification-preview">
      {notifications.map((notification) => (
        <div key={notification.id}>
          <NotificationIcon tone={notification.tone} />
          <div>
            <strong>{notification.title}</strong>
            <span>{notification.message}</span>
            {notification.fields?.length ? (
              <div className="notification-fields" aria-label="Campos destacados">
                {notification.fields.map((field) => (
                  <span key={`${notification.id}-${field}`} className="notification-field">
                    {formatNotificationField(field)}
                  </span>
                ))}
              </div>
            ) : null}
            <small>{notification.time}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectorBars({ sectors }: { sectors: Sector[] }) {
  return (
    <div className="sector-bars">
      {sectors.map((sector) => (
        <div key={sector.id}>
          <span>{sector.name}</span>
          <small>{sector.orders} pedidos</small>
          <ProgressBar value={sector.capacity} color="#5b45ff" />
          <strong>{sector.capacity}%</strong>
        </div>
      ))}
    </div>
  );
}

function FinancePreview({ finance, revenue }: { finance: FinanceEntry[]; revenue: number }) {
  return (
    <div className="finance-preview">
      {finance.slice(0, 4).map((entry) => (
        <FinanceLine entry={entry} key={entry.id} compact />
      ))}
      <div className="cash-highlight">
        <CircleDollarSign size={26} />
        <span>Fluxo de Caixa (Hoje)</span>
        <strong>{formatCurrency(Math.min(revenue, 3250))}</strong>
      </div>
    </div>
  );
}

function FinanceLine({ entry, compact = false }: { entry: FinanceEntry; compact?: boolean }) {
  const isNegative = entry.type === "payable";
  const isMargin = entry.type === "margin";
  const Icon = financeEntryIcons[entry.type];
  const details = [
    entry.status,
    entry.due,
    entry.category,
    entry.referenceType && entry.referenceId ? `${entry.referenceType} ${entry.referenceId}` : entry.referenceType,
    entry.paymentMethod,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className={`finance-line ${compact ? "compact" : ""}`}>
      <Icon size={18} />
      <span>{entry.label}</span>
      <strong className={isNegative ? "negative" : "positive"}>
        {isMargin ? `${entry.value}%` : formatCurrency(entry.value)}
      </strong>
      {!compact ? <small className="finance-details">{details}{entry.notes ? ` - ${entry.notes}` : ""}</small> : null}
      {!compact ? <small>{entry.status} · {entry.due}</small> : null}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button className="quick-action" type="button" onClick={onClick}>
      <span style={{ "--tone": tone } as CSSProperties}>
        <Icon size={22} />
      </span>
      <strong>{label}</strong>
    </button>
  );
}

function DatabaseActionCard({
  icon: Icon,
  title,
  description,
  detail,
  tone,
  danger = false,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
  tone: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`database-action-card ${danger ? "danger" : ""}`} style={{ "--action-tone": tone } as CSSProperties} type="button" onClick={onClick}>
      <span>
        <Icon size={19} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
        <em>{detail}</em>
      </div>
    </button>
  );
}

function Modal({
  mode,
  children,
  onClose,
}: {
  mode: ModalMode;
  children: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!mode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusableElements = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;

      const firstInput = panel.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled])');
      if (firstInput) {
        firstInput.focus();
      } else {
        const firstButton = panel.querySelector<HTMLElement>('button:not([disabled])');
        firstButton?.focus();
      }
    }, 10);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mode]);

  if (!mode) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <button className="modal-scrim" type="button" aria-label="Fechar modal" onClick={onClose} />
      <div
        className={`modal-panel${mode === "order" ? " modal-panel-order" : ""}${mode === "quote" || mode === "quote-detail" || mode === "order-detail" ? " modal-panel-quote" : ""}`}
        ref={panelRef}
      >
        <button className="modal-close icon-button" type="button" aria-label="Fechar" title="Fechar" onClick={onClose}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="modal-header">
      <span>
        <Icon size={22} />
      </span>
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        value={value}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        inputMode="decimal"
        min={0}
        step="any"
        value={Number.isFinite(value) ? String(value) : ""}
        type="text"
        onChange={(event) => onChange(parseLocaleNumber(event.target.value))}
      />
    </label>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const meta = statusMeta[status];
  return (
    <span className="status-pill" style={{ "--status": meta.color, "--status-bg": meta.bg } as CSSProperties} data-testid="order-status">
      <i aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function PriorityTag({ priority }: { priority: Order["priority"] }) {
  return <span className={`priority-tag ${normalizeText(priority)}`}>{priority}</span>;
}

function ClientStatus({ status }: { status: Client["status"] }) {
  return (
    <span className={`client-status ${normalizeText(status)}`}>
      <i aria-hidden="true" />
      {status}
    </span>
  );
}

function MachineStatus({ status }: { status: Machine["status"] }) {
  return <span className={`machine-status ${normalizeText(status)}`}>{status}</span>;
}

function DangerTag({ label }: { label: string }) {
  return <span className="danger-tag">{label}</span>;
}

function SuccessTag({ label }: { label: string }) {
  return <span className="success-tag">{label}</span>;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <span className="progress-bar">
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </span>
  );
}

function NotificationIcon({ tone }: { tone: NotificationItem["tone"] }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Bell : tone === "warning" ? Clock3 : AlertTriangle;
  return (
    <span className={`notification-icon ${tone}`}>
      <Icon size={18} />
    </span>
  );
}

function MetricMini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="metric-mini" style={{ "--tone": tone } as CSSProperties}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SettingsLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="settings-line">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DownloadButton({
  filename,
  content,
  label = "Exportar",
}: {
  filename?: string;
  content?: string;
  label?: string;
}) {
  return (
    <button
      className="ghost-button compact"
      type="button"
      onClick={filename && content ? () => downloadReportFile(filename, content) : undefined}
    >
      <Download size={16} />
      {label}
    </button>
  );
}

function downloadReportFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function pointsFromData(data: number[], width: number, height: number) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(max - min, 1);

  return data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) + 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatShortDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) {
    return "Hoje";
  }

  return `${day}/${month}`;
}

function visualColor(category: string) {
  const key = normalizeText(category);
  if (key.includes("brinde")) {
    return "#16b981";
  }
  if (key.includes("visual")) {
    return "#0a84ff";
  }
  if (key.includes("textil")) {
    return "#ff7a00";
  }
  if (key.includes("papel")) {
    return "#ee3045";
  }
  return "#5b45ff";
}
