export type ViewKey =
  | "dashboard"
  | "orders"
  | "production"
  | "clients"
  | "users"
  | "support"
  | "products"
  | "catalog"
  | "inventory"
  | "machines"
  | "sectors"
  | "quotes"
  | "finance"
  | "reports"
  | "files"
  | "notifications"
  | "settings";

export const QUOTE_ACCEPTANCE_KEY = "graphflow.quote.acceptances.v1";

export type OrderStatus =
  | "approval"
  | "payment"
  | "production"
  | "conference"
  | "shipping"
  | "delivered";

export type Priority = "Baixa" | "Média" | "Alta" | "Crítica";

export type Fraction = {
  id: string;
  quantity: number;
  color: string;
  note: string;
};

export type OrderArtFile = {
  id: string;
  productName: string;
  name: string;
  url: string;
  size?: string;
};

export type Order = {
  id: string;
  number?: string;
  itemId?: string;
  customer: string;
  product: string;
  productId: string;
  sector: string;
  machineId?: string;
  responsible?: string;
  quantity: number;
  total: number;
  status: OrderStatus;
  stageId?: string;
  progress: number;
  delivery: string;
  dueDate: string;
  priority: Priority;
  fractions: Fraction[];
  artFiles?: OrderArtFile[];
};

export type Client = {
  id: string;
  personType?: "PF" | "PJ";
  documentType?: "CPF" | "CNPJ";
  document?: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp?: string;
  city: string;
  address?: {
    zip: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    country: string;
  };
  avatarUrl?: string;
  notes?: string;
  orders: number;
  revenue: number;
  status: "Ativo" | "Atenção" | "Inativo";
};

export type UserAccountType = "ADMIN" | "OPERATOR" | "CLIENT";

export type UserAccount = {
  id: string;
  tenantId: string;
  type: UserAccountType;
  name: string;
  email: string;
  phone: string;
  document: string;
  avatarUrl: string;
  whatsapp?: string;
  personalEmail?: string;
  birthDate?: string;
  address?: {
    zip: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    country: string;
  };
  department?: string;
  jobTitle?: string;
  admissionDate?: string;
  supervisor?: string;
  shift?: string;
  costCenter?: string;
  bank?: string;
  bankAccount?: string;
  pixKey?: string;
  notes?: string;
  profileComplete?: boolean;
  createdAt?: string;
  updatedAt?: string;
  role: "ADMIN" | "MANAGER" | "OPERATOR" | "FINANCE" | "CLIENT" | "VIEWER";
  permissions: string[];
  sectorIds: string[];
  status: "Ativo" | "Convidado" | "Suspenso" | "Inativo";
};

export type Product = {
  id: string;
  sku?: string;
  name: string;
  category: string;
  subcategory?: string;
  sector: string;
  description?: string;
  commercialDescription?: string;
  complementaryDescription?: string;
  gtin?: string;
  brand?: string;
  thumbnailUrl?: string;
  availableColors: string[];
  price: number;
  costPrice?: number;
  markupPercent?: number;
  minSalePrice?: number;
  priceTable?: string;
  minOrderQty: number;
  minFractionQty: number;
  allowsFractions: boolean;
  stockItem: string;
  stockQty?: number;
  stockMin?: number;
  stockUnit?: string;
  commercialUnit?: string;
  conversionFactor?: string;
  netWeightKg?: string;
  grossWeightKg?: string;
  packageDimensionsCm?: string;
  storageLocation?: string;
  tracksBatch?: boolean;
  fiscal?: ProductFiscalData;
  isResale?: boolean;
  internalNotes?: string;
  leadTime: string;
  active: boolean;
  saleBlocked?: boolean;
};

export type ProductFiscalData = {
  ncm: string;
  cest: string;
  origin: string;
  cfop: string;
  icmsCstCsosn: string;
  pisCst: string;
  cofinsCst: string;
  ipiCst: string;
  icmsRate: string;
  pisRate: string;
  cofinsRate: string;
  ipiRate: string;
  additionalInfo: string;
};

export const DEFAULT_PRODUCT_COLORS = ["Azul", "Verde", "Preto", "Branco"];

const productColors = {
  print: ["Azul", "Verde", "Preto", "Branco", "Vermelho"],
  laser: ["Prata", "Preto", "Azul"],
  textile: ["Branco", "Preto", "Azul", "Cinza"],
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  lastMove: string;
};

export type QuoteStatus = "Rascunho" | "Enviado" | "Aceito" | "Expirado";

export type QuoteItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Quote = {
  id: string;
  publicQuoteId?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  responsible: string;
  validUntil: string;
  notes: string;
  status: QuoteStatus;
  publicToken: string;
  createdAt: string;
  acceptedAt?: string;
  items: QuoteItem[];
};

export type Machine = {
  id: string;
  name: string;
  sector: string;
  status: "Operando" | "Manutenção" | "Ociosa";
  utilization: number;
  nextMaintenance: string;
  costMonth: number;
};

export type Sector = {
  id: string;
  name: string;
  orders: number;
  capacity: number;
  sla: string;
  lead: string;
};

export type FinanceEntry = {
  id: string;
  label: string;
  type: "receivable" | "payable" | "profit" | "margin" | "cash";
  value: number;
  due: string;
  status: "Recebido" | "Pendente" | "Atrasado" | "Projetado";
  category?: string;
  referenceType?: "Pedido" | "Produto" | "Cliente" | "Fornecedor" | "Geral";
  referenceId?: string;
  paymentMethod?: string;
  notes?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  tone: "danger" | "warning" | "info" | "success";
  read: boolean;
};

export type FileItem = {
  id: string;
  name: string;
  type: "Arte" | "Contrato" | "Relatório" | "Comprovante";
  size: string;
  linkedTo: string;
  url?: string;
  owner?: string;
  notes?: string;
  updatedAt: string;
};

export const navItems: Array<{ id: ViewKey; label: string; badge?: number }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "orders", label: "Pedidos" },
  { id: "production", label: "Produção" },
  { id: "clients", label: "Clientes" },
  { id: "users", label: "Usuarios" },
  { id: "support", label: "Atendimento" },
  { id: "products", label: "Produtos" },
  { id: "catalog", label: "Catálogo" },
  { id: "inventory", label: "Estoque" },
  { id: "machines", label: "Máquinas" },
  { id: "sectors", label: "Setores" },
  { id: "quotes", label: "Orçamentos" },
  { id: "finance", label: "Financeiro" },
  { id: "reports", label: "Relatórios" },
  { id: "files", label: "Arquivos" },
  { id: "notifications", label: "Notificações", badge: 8 },
  { id: "settings", label: "Configurações" },
];

export const statusMeta: Record<
  OrderStatus,
  { label: string; color: string; bg: string }
> = {
  approval: {
    label: "Aguardando aprovação",
    color: "#5b45ff",
    bg: "rgba(91, 69, 255, 0.1)",
  },
  payment: {
    label: "Aguardando pagamento",
    color: "#fb920c",
    bg: "rgba(251, 146, 12, 0.12)",
  },
  production: {
    label: "Em produção",
    color: "#16b981",
    bg: "rgba(22, 185, 129, 0.12)",
  },
  conference: {
    label: "Conferência",
    color: "#0a84ff",
    bg: "rgba(10, 132, 255, 0.12)",
  },
  shipping: {
    label: "Expedição",
    color: "#c026d3",
    bg: "rgba(192, 38, 211, 0.12)",
  },
  delivered: {
    label: "Entregues",
    color: "#10a37f",
    bg: "rgba(16, 163, 127, 0.12)",
  },
};

export const initialOrders: Order[] = [
  {
    id: "#1247",
    customer: "João Silva",
    product: "Adesivos Personalizados",
    productId: "prod-adesivos",
    sector: "Impressão",
    machineId: "maq-uv",
    responsible: "Carla Nunes",
    quantity: 500,
    total: 2450,
    status: "production",
    progress: 65,
    delivery: "24/05",
    dueDate: "2025-05-24",
    priority: "Alta",
    fractions: [
      { id: "f1", quantity: 200, color: "Azul Marinho", note: "Laminação fosca" },
      { id: "f2", quantity: 200, color: "Vermelho", note: "Corte especial" },
      { id: "f3", quantity: 100, color: "Preto", note: "Acabamento padrão" },
    ],
  },
  {
    id: "#1246",
    customer: "Maria Fernandes",
    product: "Canetas Personalizadas",
    productId: "prod-canetas",
    sector: "Gravação Laser",
    machineId: "maq-laser",
    responsible: "Diego Rocha",
    quantity: 1000,
    total: 3900,
    status: "payment",
    progress: 40,
    delivery: "25/05",
    dueDate: "2025-05-25",
    priority: "Média",
    fractions: [
      { id: "f4", quantity: 400, color: "Azul", note: "Logo branco" },
      { id: "f5", quantity: 300, color: "Vermelho", note: "Logo preto" },
      { id: "f6", quantity: 300, color: "Preto", note: "Logo prata" },
    ],
  },
  {
    id: "#1245",
    customer: "Agência Pixel",
    product: "Banners 80x120cm",
    productId: "prod-banners",
    sector: "Impressão",
    machineId: "maq-uv",
    responsible: "Carla Nunes",
    quantity: 18,
    total: 1710,
    status: "production",
    progress: 75,
    delivery: "26/05",
    dueDate: "2025-05-26",
    priority: "Alta",
    fractions: [],
  },
  {
    id: "#1244",
    customer: "Studio Mais",
    product: "Camisetas Personalizadas",
    productId: "prod-camisetas",
    sector: "Sublimação",
    machineId: "maq-sublimacao",
    responsible: "Marina Souza",
    quantity: 120,
    total: 4200,
    status: "conference",
    progress: 30,
    delivery: "27/05",
    dueDate: "2025-05-27",
    priority: "Média",
    fractions: [
      { id: "f7", quantity: 60, color: "Branca", note: "P/M/G" },
      { id: "f8", quantity: 60, color: "Preta", note: "P/M/G" },
    ],
  },
  {
    id: "#1243",
    customer: "Loja Centro",
    product: "Cartões de Visita",
    productId: "prod-cartoes",
    sector: "Acabamento",
    machineId: "maq-corte",
    responsible: "Rafael Costa",
    quantity: 2000,
    total: 720,
    status: "shipping",
    progress: 90,
    delivery: "24/05",
    dueDate: "2025-05-24",
    priority: "Baixa",
    fractions: [],
  },
];

export const initialClients: Client[] = [
  {
    id: "cli-joao",
    name: "João Silva",
    company: "Mercado Silva",
    email: "joao@mercadosilva.com",
    phone: "(11) 98765-3311",
    city: "São Paulo",
    orders: 12,
    revenue: 42870,
    status: "Ativo",
  },
  {
    id: "cli-maria",
    name: "Maria Fernandes",
    company: "MF Eventos",
    email: "maria@mfeventos.com",
    phone: "(21) 99821-7710",
    city: "Rio de Janeiro",
    orders: 8,
    revenue: 29100,
    status: "Ativo",
  },
  {
    id: "cli-pixel",
    name: "Agência Pixel",
    company: "Pixel Comunicação",
    email: "ops@pixel.com",
    phone: "(31) 3333-7800",
    city: "Belo Horizonte",
    orders: 21,
    revenue: 68120,
    status: "Atenção",
  },
  {
    id: "cli-studio",
    name: "Studio Mais",
    company: "Studio Mais Design",
    email: "contato@studiomais.com",
    phone: "(41) 3455-9090",
    city: "Curitiba",
    orders: 5,
    revenue: 13240,
    status: "Ativo",
  },
];

export const initialProducts: Product[] = [
  {
    id: "prod-adesivos",
    name: "Adesivos Personalizados",
    category: "Adesivos",
    sector: "Impressão",
    availableColors: productColors.print,
    price: 4.9,
    minOrderQty: 50,
    minFractionQty: 50,
    allowsFractions: true,
    stockItem: "Vinil Branco",
    leadTime: "2 dias",
    active: true,
  },
  {
    id: "prod-canetas",
    name: "Canetas Personalizadas",
    category: "Brindes",
    sector: "Gravação Laser",
    availableColors: productColors.laser,
    price: 3.9,
    minOrderQty: 100,
    minFractionQty: 50,
    allowsFractions: true,
    stockItem: "Caneta Metal",
    leadTime: "3 dias",
    active: true,
  },
  {
    id: "prod-banners",
    name: "Banners 80x120cm",
    category: "Comunicação Visual",
    sector: "Impressão",
    availableColors: DEFAULT_PRODUCT_COLORS,
    price: 95,
    minOrderQty: 1,
    minFractionQty: 1,
    allowsFractions: false,
    stockItem: "Lona 440g",
    leadTime: "1 dia",
    active: true,
  },
  {
    id: "prod-camisetas",
    name: "Camisetas Personalizadas",
    category: "Têxtil",
    sector: "Sublimação",
    availableColors: productColors.textile,
    price: 35,
    minOrderQty: 20,
    minFractionQty: 10,
    allowsFractions: true,
    stockItem: "Camiseta Dry",
    leadTime: "4 dias",
    active: true,
  },
  {
    id: "prod-cartoes",
    name: "Cartões de Visita",
    category: "Papelaria",
    sector: "Acabamento",
    availableColors: DEFAULT_PRODUCT_COLORS,
    price: 0.36,
    minOrderQty: 500,
    minFractionQty: 100,
    allowsFractions: false,
    stockItem: "Papel Couchê 300g",
    leadTime: "2 dias",
    active: true,
  },
];

export const initialInventory: InventoryItem[] = [
  {
    id: "inv-vinil",
    name: "Vinil Branco",
    category: "Impressão",
    quantity: 18,
    minQuantity: 30,
    unit: "m",
    lastMove: "10 min atrás",
  },
  {
    id: "inv-caneta",
    name: "Caneta Metal",
    category: "Brindes",
    quantity: 1450,
    minQuantity: 500,
    unit: "un",
    lastMove: "1 hora atrás",
  },
  {
    id: "inv-lona",
    name: "Lona 440g",
    category: "Comunicação Visual",
    quantity: 62,
    minQuantity: 25,
    unit: "m",
    lastMove: "2 horas atrás",
  },
  {
    id: "inv-camiseta",
    name: "Camiseta Dry",
    category: "Têxtil",
    quantity: 220,
    minQuantity: 80,
    unit: "un",
    lastMove: "3 horas atrás",
  },
  {
    id: "inv-papel",
    name: "Papel Couchê 300g",
    category: "Papelaria",
    quantity: 9100,
    minQuantity: 3000,
    unit: "fls",
    lastMove: "Ontem",
  },
];

export const initialQuotes: Quote[] = [
  {
    id: "ORC-1024",
    customerId: "cli-pixel",
    customerName: "Agência Pixel",
    customerEmail: "ops@pixel.com",
    responsible: "Carla Nunes",
    validUntil: "2025-06-15",
    notes: "Valores incluem produção, acabamento e conferência final antes da entrega.",
    status: "Enviado",
    publicToken: "quote-pixel-1024",
    createdAt: "24/05/2025",
    items: [
      {
        id: "quote-item-1",
        productId: "prod-banners",
        productName: "Banners 80x120cm",
        quantity: 10,
        unitPrice: 95,
        total: 950,
      },
      {
        id: "quote-item-2",
        productId: "prod-adesivos",
        productName: "Adesivos Personalizados",
        quantity: 300,
        unitPrice: 4.9,
        total: 1470,
      },
    ],
  },
];

export const initialMachines: Machine[] = [
  {
    id: "maq-uv",
    name: "Impressora UV",
    sector: "Impressão",
    status: "Manutenção",
    utilization: 34,
    nextMaintenance: "Hoje",
    costMonth: 4200,
  },
  {
    id: "maq-laser",
    name: "Laser CO2 90W",
    sector: "Gravação Laser",
    status: "Operando",
    utilization: 76,
    nextMaintenance: "12/06",
    costMonth: 1850,
  },
  {
    id: "maq-sublimacao",
    name: "Prensa Térmica",
    sector: "Sublimação",
    status: "Operando",
    utilization: 61,
    nextMaintenance: "18/06",
    costMonth: 940,
  },
  {
    id: "maq-corte",
    name: "Guilhotina Digital",
    sector: "Acabamento",
    status: "Ociosa",
    utilization: 22,
    nextMaintenance: "02/07",
    costMonth: 610,
  },
];

export const initialSectors: Sector[] = [
  { id: "sec-comercial", name: "Comercial", orders: 8, capacity: 40, sla: "98%", lead: "1h" },
  { id: "sec-arte", name: "Arte Final", orders: 12, capacity: 60, sla: "94%", lead: "4h" },
  { id: "sec-impressao", name: "Impressão", orders: 18, capacity: 80, sla: "91%", lead: "8h" },
  { id: "sec-laser", name: "Gravação Laser", orders: 7, capacity: 30, sla: "97%", lead: "6h" },
  { id: "sec-acabamento", name: "Acabamento", orders: 10, capacity: 50, sla: "95%", lead: "5h" },
];

export const initialFinance: FinanceEntry[] = [
  {
    id: "fin-rec",
    label: "Contas a Receber",
    type: "receivable",
    value: 45742.3,
    due: "7 dias",
    status: "Pendente",
  },
  {
    id: "fin-pay",
    label: "Contas a Pagar",
    type: "payable",
    value: 15210,
    due: "5 dias",
    status: "Pendente",
  },
  {
    id: "fin-profit",
    label: "Lucro do Mês",
    type: "profit",
    value: 32532.3,
    due: "Maio",
    status: "Projetado",
  },
  {
    id: "fin-margin",
    label: "Margem de Lucro",
    type: "margin",
    value: 24.5,
    due: "Maio",
    status: "Projetado",
  },
  {
    id: "fin-cash",
    label: "Fluxo de Caixa (Hoje)",
    type: "cash",
    value: 3250,
    due: "Hoje",
    status: "Recebido",
  },
];

export const initialNotifications: NotificationItem[] = [
  {
    id: "not-stock",
    title: "Estoque baixo",
    message: "O produto Vinil Branco está com estoque abaixo do mínimo.",
    time: "10 min atrás",
    tone: "danger",
    read: false,
  },
  {
    id: "not-delay",
    title: "Pedido atrasado",
    message: "O pedido #1223 está atrasado há 2 dias.",
    time: "1 hora atrás",
    tone: "warning",
    read: false,
  },
  {
    id: "not-maintenance",
    title: "Manutenção necessária",
    message: "A máquina Impressora UV precisa de manutenção.",
    time: "3 horas atrás",
    tone: "warning",
    read: false,
  },
  {
    id: "not-payment",
    title: "Pagamento confirmado",
    message: "O pedido #1241 teve pagamento confirmado.",
    time: "Hoje",
    tone: "success",
    read: true,
  },
];

export const initialFiles: FileItem[] = [
  {
    id: "file-arte-1247",
    name: "adesivos-joao-silva.ai",
    type: "Arte",
    size: "18.4 MB",
    linkedTo: "#1247",
    updatedAt: "Hoje",
  },
  {
    id: "file-contrato-mf",
    name: "contrato-mf-eventos.pdf",
    type: "Contrato",
    size: "1.2 MB",
    linkedTo: "Maria Fernandes",
    updatedAt: "Ontem",
  },
  {
    id: "file-dre",
    name: "dre-maio.xlsx",
    type: "Relatório",
    size: "740 KB",
    linkedTo: "Financeiro",
    updatedAt: "31/05",
  },
];

export const revenueSeries = [18, 34, 31, 58, 41, 72, 63, 95, 88, 112, 91, 126, 104, 151, 143, 171, 164, 187];
export const sparkSeries = {
  orders: [10, 8, 13, 11, 14, 7, 12, 6, 15, 11, 18, 14, 20, 21],
  revenue: [11, 8, 9, 13, 14, 11, 10, 9, 13, 12, 17, 11, 12, 21],
  production: [15, 14, 13, 15, 18, 17, 15, 16, 12, 18, 13, 22, 15, 19],
  delivery: [9, 8, 11, 9, 12, 10, 11, 10, 12, 11, 15, 11, 13, 18],
  alerts: [5, 6, 9, 10, 6, 5, 7, 9, 6, 8, 5, 7, 6, 12, 10],
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function orderMatchesQuery(order: Order, query: string) {
  const target = normalizeText(
    `${order.id} ${order.customer} ${order.product} ${order.sector} ${order.responsible ?? ""} ${statusMeta[order.status].label}`,
  );
  return target.includes(normalizeText(query));
}

export function productMatchesQuery(product: Product, query: string) {
  const target = normalizeText(
    `${product.name} ${product.category} ${product.sector} ${product.stockItem}`,
  );
  return target.includes(normalizeText(query));
}

export function calculateOrderTotal(product: Product | undefined, quantity: number) {
  if (!product || !Number.isFinite(quantity)) {
    return 0;
  }

  return product.price * Math.max(quantity, 0);
}

export function sumFractions(fractions: Fraction[]) {
  return fractions.reduce((sum, fraction) => sum + Number(fraction.quantity || 0), 0);
}
