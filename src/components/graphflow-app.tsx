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
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  GripVertical,
  Home,
  Layers3,
  Link2,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
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
  Trash2,
  Truck,
  Upload,
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
  type Quote,
  type QuoteItem,
  type QuoteStatus,
  type Sector,
  type UserAccount,
  type ViewKey,
} from "@/lib/graphflow-data";
import { graphflowApi, type DashboardOverview } from "@/lib/graphflow-api";
import {
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
  | "client"
  | "user"
  | "product"
  | "product-edit"
  | "machine"
  | "maintenance"
  | "expense"
  | "file"
  | null;

type NewOrderDraft = {
  customerId: string;
  productId: string;
  quantity: number;
  deliveryDate: string;
  fractions: Fraction[];
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
  permissions: string[];
  sectorIds: string[];
  password: string;
};

type ProductDraft = Pick<
  Product,
  | "name"
  | "category"
  | "sector"
  | "thumbnailUrl"
  | "price"
  | "minOrderQty"
  | "minFractionQty"
  | "allowsFractions"
  | "stockItem"
> & {
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

const defaultOrderDraft = (products: Product[], clients: Client[]): NewOrderDraft => ({
  customerId: clients[0]?.id ?? "",
  productId: products[0]?.id ?? "",
  quantity: products[0]?.minOrderQty ?? 50,
  deliveryDate: dateInputAfterDays(7),
  artFileName: "",
  artFileUrl: "",
  fractions: [
    {
      id: "fraction-1",
      quantity: products[0]?.minFractionQty ?? 50,
      color: firstProductColor(products[0]),
      note: "Variação principal",
    },
  ],
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
  permissions: ["dashboard:read", "orders:read", "production:read"],
  sectorIds: [],
  password: "",
};

const defaultProductDraft: ProductDraft = {
  name: "",
  category: "Papelaria",
  sector: "Impressão",
  thumbnailUrl: "",
  availableColorsText: DEFAULT_PRODUCT_COLORS.join(", "),
  price: 0,
  minOrderQty: 50,
  minFractionQty: 50,
  allowsFractions: true,
  stockItem: "Vinil Branco",
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

const defaultQuoteDraft = (products: Product[], clients: Client[]): QuoteDraft => {
  const client = clients.find((item) => item.id === "cli-pixel") ?? clients[0];
  const folderProduct = products.find((item) => item.id === "prod-adesivos") ?? products[0];
  const cardProduct = products.find((item) => item.id === "prod-cartoes") ?? products[1] ?? products[0];
  const bannerProduct = products.find((item) => item.id === "prod-banners") ?? products[2] ?? products[0];
  const items = [
    folderProduct
      ? {
          id: "quote-draft-folder",
          productId: folderProduct.id,
          productName: "Folder A4",
          quantity: 500,
          unitPrice: 1.2,
          total: 600,
        }
      : null,
    cardProduct
      ? {
          id: "quote-draft-card",
          productId: cardProduct.id,
          productName: "Cartão de Visita",
          quantity: 1000,
          unitPrice: 0.35,
          total: 350,
        }
      : null,
    bannerProduct
      ? {
          id: "quote-draft-banner",
          productId: bannerProduct.id,
          productName: "Banner 80x120cm",
          quantity: 1,
          unitPrice: 85,
          total: 85,
        }
      : null,
  ].filter(Boolean) as QuoteItem[];

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
    items,
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
    title: "Usuarios",
    eyebrow: "Operadores, clientes, permissoes e acesso por setor.",
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
  quotes: FileText,
  finance: WalletCards,
  reports: ArrowUpRight,
  files: Folder,
  notifications: Bell,
  settings: Settings,
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
    items: ["clients", "users", "quotes", "finance", "settings"],
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

const STORAGE_KEY = "graphflow.frontend.v1";
const QUOTE_DRAFT_STORAGE_KEY = "graphflow.quote.draft.v1";
const QUOTE_PUBLIC_LINKS_STORAGE_KEY = "graphflow.quote.public-links.v1";
const PROFILE_COMPLETION_NOTICE_KEY = "graphflow.profile-completion-notice.v1";

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

function loadSavedQuoteDraft(products: Product[], clients: Client[]): QuoteDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as QuoteDraft;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      ...defaultQuoteDraft(products, clients),
      ...parsed,
    };
  } catch {
    return null;
  }
}

export function GraphFlowApp() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(() => graphflowApi.enabled());
  const [dataLoading, setDataLoading] = useState(false);
  const [dashboardOverview, setDashboardOverview] = useState<DashboardOverview | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [productionStages, setProductionStages] =
    useState<ProductionStage[]>([]);
  const [productionStageFocusSignal, setProductionStageFocusSignal] = useState(0);
  const [finance, setFinance] = useState<FinanceEntry[]>([]);
  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);
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
    defaultQuoteDraft([], []),
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  function productToDraft(product: Product): ProductDraft {
    return {
      name: product.name,
      category: product.category,
      sector: product.sector,
      thumbnailUrl: product.thumbnailUrl ?? "",
      availableColorsText: (product.availableColors?.length ? product.availableColors : DEFAULT_PRODUCT_COLORS).join(", "),
      price: product.price,
      minOrderQty: product.minOrderQty,
      minFractionQty: product.minFractionQty,
      allowsFractions: product.allowsFractions,
      stockItem: product.stockItem,
    };
  }

  function stagesFromSectors(remoteSectors: Sector[]): ProductionStage[] {
    return remoteSectors.map((sector, index) => ({
      id: sector.id,
      name: sector.name,
      color: stagePalette[index % stagePalette.length],
    }));
  }

  async function refreshWorkspace() {
    if (!graphflowApi.enabled()) return;

    try {
      setDataLoading(true);
      const [workspace, overview] = await Promise.all([
        graphflowApi.loadWorkspace(),
        graphflowApi.dashboardOverview().catch(() => null),
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
      setFiles(workspace.files);
      setNotifications(workspace.notifications);
      setOrderDraft(defaultOrderDraft(workspace.products, workspace.clients));
      setQuoteDraft(loadSavedQuoteDraft(workspace.products, workspace.clients) ?? defaultQuoteDraft(workspace.products, workspace.clients));
      setDashboardOverview(overview);
    } catch (error) {
      createNotification({
        tone: "danger",
        title: "Falha ao carregar dados",
        message: error instanceof Error ? error.message : "Nao foi possivel consultar o backend.",
      });
    } finally {
      setDataLoading(false);
    }
  }

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
  }, []);

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
          setAuthenticated(true);
          await refreshWorkspace();
        }
      })
      .catch(() => {
        if (active) {
          setAuthenticated(false);
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

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authenticated || !authUserId || !users.length) {
      return;
    }

    const currentUser = users.find((user) => user.id === authUserId || user.email === authUserId);

    if (!currentUser || currentUser.profileComplete) {
      return;
    }

    try {
      const notified = JSON.parse(
        window.localStorage.getItem(PROFILE_COMPLETION_NOTICE_KEY) ?? "{}",
      ) as Record<string, boolean>;

      if (notified[currentUser.id]) {
        return;
      }

      createNotification({
        tone: "info",
        title: "Complete seu cadastro",
        message: "Revise telefone, endereco, setor e dados operacionais para liberar o perfil completo.",
      });

      window.localStorage.setItem(
        PROFILE_COMPLETION_NOTICE_KEY,
        JSON.stringify({ ...notified, [currentUser.id]: true }),
      );
    } catch {
      createNotification({
        tone: "info",
        title: "Complete seu cadastro",
        message: "Revise telefone, endereco, setor e dados operacionais para liberar o perfil completo.",
      });
    }
  }, [authenticated, authUserId, users]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === orderDraft.productId),
    [orderDraft.productId, products],
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === orderDraft.customerId),
    [clients, orderDraft.customerId],
  );

  const orderTotal = calculateOrderTotal(selectedProduct, orderDraft.quantity);
  const fractionTotal = sumFractions(orderDraft.fractions);

  const orderValidation = useMemo(() => {
    if (!selectedClient) {
      return "Selecione um cliente válido.";
    }

    if (!selectedProduct) {
      return "Selecione um produto válido.";
    }

    if (orderDraft.quantity < selectedProduct.minOrderQty) {
      return `Quantidade mínima: ${formatNumber(selectedProduct.minOrderQty)}.`;
    }

    if (orderDraft.deliveryDate && orderDraft.deliveryDate < todayInputDate()) {
      return "A entrega precisa ser hoje ou uma data futura.";
    }

    if (orderDraft.fractions.length === 0) {
      return null;
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
  }, [fractionTotal, orderDraft.deliveryDate, orderDraft.fractions, orderDraft.quantity, selectedClient, selectedProduct]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => orderMatchesQuery(order, query)),
    [orders, query],
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

  useEffect(() => {
    const saved = window.localStorage.getItem("graphflow.sidebarCollapsed");
    if (saved) {
      setSidebarCollapsed(saved === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("graphflow.sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  function openModal(mode: Exclude<ModalMode, null>) {
    if (mode === "order-detail") {
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
    if (mode === "file") {
      setFileDraft(defaultFileDraft);
    }

    setModalMode(mode);
  }

  function closeModal() {
    setModalMode(null);
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

  function createNotification(item: Omit<NotificationItem, "id" | "read" | "time">) {
    setNotifications((current) => [
      {
        id: `not-${Date.now()}`,
        time: "agora",
        read: false,
        ...item,
      },
      ...current,
    ]);
  }

  async function uploadFile(file: File, scope: UploadScope): Promise<UploadedFile> {
    if (graphflowApi.enabled()) {
      const uploaded = await graphflowApi.uploadFile(file, scope);
      createNotification({
        tone: "success",
        title: "Upload concluido",
        message: `${uploaded.name} foi enviado com seguranca para o storage.`,
      });
      return uploaded;
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

    if (orderValidation || !selectedProduct || !selectedClient) {
      return;
    }

    const assignedMachine = machines.find((machine) => machine.sector === selectedProduct.sector);
    const selectedSector = sectors.find((sector) => sector.name === selectedProduct.sector);

    if (graphflowApi.enabled()) {
      try {
        const nextOrder = await graphflowApi.createOrder(
          {
            customerId: selectedClient.id,
            product: selectedProduct,
            quantity: orderDraft.quantity,
            deliveryDate: orderDraft.deliveryDate,
            machineId: assignedMachine?.id,
            sectorId: selectedSector?.id,
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
            linkedTo: `${nextOrder.number ?? nextOrder.id} · ${selectedProduct.name}`,
            size: "arquivo externo",
          }).catch(() => null);
        }
        await refreshWorkspace();
        createNotification({
          tone: "info",
          title: "Novo pedido criado",
          message: `${nextOrder.number ?? nextOrder.id} para ${selectedClient.name} entrou em producao.`,
        });
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

    const nextNumber =
      Math.max(...orders.map((order) => Number(order.id.replace(/\D/g, ""))), 1247) + 1;
    const nextOrder: Order = {
      id: `#${nextNumber}`,
      number: `#${nextNumber}`,
      customer: selectedClient.name,
      product: selectedProduct.name,
      productId: selectedProduct.id,
      sector: selectedProduct.sector,
      machineId: assignedMachine?.id,
      responsible: "Carla Nunes",
      quantity: orderDraft.quantity,
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
              productName: selectedProduct.name,
              name: orderDraft.artFileName.trim(),
              url: orderDraft.artFileUrl.trim() || "#",
              size: "arquivo externo",
            },
          ]
        : [],
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
      current.map((item) =>
        item.name === selectedProduct.stockItem
          ? {
              ...item,
              quantity: Math.max(0, item.quantity - Math.ceil(orderDraft.quantity / 100)),
              lastMove: "agora",
            }
          : item,
      ),
    );
    setSectors((current) =>
      current.map((sector) =>
        sector.name === selectedProduct.sector
          ? { ...sector, orders: sector.orders + 1, capacity: Math.min(100, sector.capacity + 3) }
          : sector,
      ),
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

    if (!productDraft.name.trim() || productDraft.price <= 0) {
      return;
    }

    const nextProduct: Product = {
      id: `prod-${Date.now()}`,
      name: productDraft.name,
      category: productDraft.category,
      sector: productDraft.sector,
      thumbnailUrl: productDraft.thumbnailUrl,
      availableColors: parseAvailableColors(productDraft.availableColorsText),
      price: productDraft.price,
      minOrderQty: productDraft.minOrderQty,
      minFractionQty: productDraft.minFractionQty,
      allowsFractions: productDraft.allowsFractions,
      stockItem: productDraft.stockItem,
      leadTime: "2 dias",
      active: true,
    };

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
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
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

    if (!editingProductId || !productDraft.name.trim() || productDraft.price <= 0) {
      return;
    }

    const selectedSector = sectors.find((sector) => sector.name === productDraft.sector);

    if (graphflowApi.enabled()) {
      try {
        const savedProduct = await graphflowApi.updateProduct(
          editingProductId,
          {
            name: productDraft.name,
            category: productDraft.category,
            sector: productDraft.sector,
            thumbnailUrl: productDraft.thumbnailUrl,
            availableColors: parseAvailableColors(productDraft.availableColorsText),
            price: productDraft.price,
            minOrderQty: productDraft.minOrderQty,
            minFractionQty: productDraft.minFractionQty,
            allowsFractions: productDraft.allowsFractions,
            stockItem: productDraft.stockItem,
          },
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
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === editingProductId
          ? {
              ...product,
              name: productDraft.name,
              category: productDraft.category,
              sector: productDraft.sector,
              thumbnailUrl: productDraft.thumbnailUrl,
              availableColors: parseAvailableColors(productDraft.availableColorsText),
              price: productDraft.price,
              minOrderQty: productDraft.minOrderQty,
              minFractionQty: productDraft.minFractionQty,
              allowsFractions: productDraft.allowsFractions,
              stockItem: productDraft.stockItem,
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

  function scheduleMachineMaintenance() {
    const machine = machines.find((item) => item.status !== "Manutenção");

    if (!machine) {
      createNotification({
        tone: "info",
        title: "Máquinas em manutenção",
        message: "Todas as máquinas já estão marcadas para manutenção.",
      });
      setView("machines");
      return;
    }

    void openMachineMaintenance(machine.id);
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

    setSectors((current) => [
      {
        id: `sec-${Date.now()}`,
        name: `Novo Setor ${current.length + 1}`,
        orders: 0,
        capacity: 0,
        sla: "100%",
        lead: "0h",
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
            items,
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
        setView("quotes");
      } catch (error) {
        createNotification({
          tone: "danger",
          title: "Orcamento nao salvo",
          message: error instanceof Error ? error.message : "Falha ao conectar com o backend.",
        });
      }
      return;
    }

    const id = `ORC-${String(Date.now()).slice(-6)}`;
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
    setView("quotes");
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
      case "orders":
        return { label: "Novo Pedido", icon: ClipboardList, onClick: () => openModal("order") };
      case "production":
        return {
          label: "Novo Estágio",
          icon: Layers3,
          onClick: () => setProductionStageFocusSignal((current) => current + 1),
        };
      case "clients":
        return { label: "Novo Cliente", icon: UserPlus, onClick: () => openModal("client") };
      case "users":
        return { label: "Novo Usuario", icon: UserCog, onClick: () => openModal("user") };
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
          onClick: () => {
            setQuoteDraft(defaultQuoteDraft(products, clients));
            setView("quotes");
          },
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
  const selectedOrder = selectedOrderId
    ? orders.find((order) => order.id === selectedOrderId)
    : undefined;

  if (authChecking) {
    return <AuthLoadingScreen />;
  }

  if (!authenticated) {
    return (
      <LoginScreen
        onSubmit={async () => {
          const session = graphflowApi.enabled()
            ? await graphflowApi.session().catch(() => null)
            : null;
          setAuthUserId(session?.user.id ?? null);
          setAuthenticated(true);
          await refreshWorkspace();
          setView("dashboard");
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onViewChange={(nextView) => {
          setView(nextView);
          setSidebarOpen(false);
        }}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        unreadCount={unreadCount}
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
          onLogout={() => {
            graphflowApi.logout().catch(() => undefined);
            setAuthUserId(null);
            setAuthenticated(false);
          }}
        />

        <div className="page-frame">
          {dataLoading ? <div className="data-loading">Atualizando dados do banco...</div> : null}
          {view !== "quotes" && view !== "support" ? (
          <header className="page-header">
            <div>
              <h1>{currentCopy.title}</h1>
              <p>{currentCopy.eyebrow}</p>
            </div>
            <div className="header-actions">
              <button
                className="date-button"
                type="button"
                aria-label="Selecionar data"
                title="Selecionar data"
              >
                <CalendarDays size={18} />
                <span>Hoje, 24 de Maio de 2025</span>
                <ChevronDown size={16} />
              </button>
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
              overview={dashboardOverview}
              orders={orders}
              finance={finance}
              inventory={inventory}
              notifications={notifications}
              sectors={sectors}
              onOpenModal={openModal}
              onViewChange={setView}
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
              orders={filteredOrders}
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
                setQuoteDraft(defaultQuoteDraft(products, clients));
                setView("quotes");
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
              onSelectProduct={(productId) => {
                setOrderDraft({
                  ...defaultOrderDraft(products, clients),
                  productId,
                  quantity:
                    products.find((product) => product.id === productId)?.minOrderQty ?? 50,
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
              products={products}
              onUpdateSector={updateSector}
              onDeleteSector={deleteSector}
              onLinkProduct={linkProductToSector}
            />
          ) : null}

          {view === "quotes" ? (
            <QuotesView
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

          {view === "finance" ? (
            <FinanceView
              finance={finance}
              onCreateExpense={() => openModal("expense")}
              onScheduleCharge={scheduleCharge}
              onSendReminder={sendPaymentReminder}
            />
          ) : null}

          {view === "reports" ? (
            <ReportsView orders={orders} finance={finance} sectors={sectors} />
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

          {view === "settings" ? (
            <SettingsView dark={dark} onToggleTheme={() => setDark((current) => !current)} onRefreshData={refreshData} />
          ) : null}
        </div>
      </main>

      <Modal mode={modalMode} onClose={closeModal}>
        {modalMode === "order-detail" && selectedOrder ? (
          <OrderDetail
            order={selectedOrder}
            files={files}
            products={products}
            machines={machines}
            sectors={sectors}
            users={users}
            onUploadFile={uploadFile}
            onSave={saveOrderDetail}
            onAddArtFile={addOrderArtFile}
          />
        ) : null}

        {modalMode === "order" ? (
          <OrderForm
            clients={clients}
            products={products}
            draft={orderDraft}
            onDraftChange={setOrderDraft}
            selectedProduct={selectedProduct}
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

        {modalMode === "file" ? (
          <FileForm draft={fileDraft} onUploadFile={uploadFile} onDraftChange={setFileDraft} onSubmit={createFile} />
        ) : null}
      </Modal>
    </div>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="login-screen">
      <section className="auth-card auth-loading-card" aria-label="Carregando sessao">
        <Image
          src={GRAPHFLOW_LOGO_SRC}
          alt="GraficFlow"
          width={260}
          height={148}
          style={{ width: 260, height: 148, objectFit: "contain" }}
          priority
        />
        <span>Validando sessao segura...</span>
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
  onViewChange,
  onClose,
  onToggleCollapsed,
}: {
  view: ViewKey;
  open: boolean;
  collapsed: boolean;
  unreadCount: number;
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

            return (
              <section className={`nav-section ${hasActiveItem ? "has-active" : ""}`} key={section.id}>
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

                    return (
                      <button
                        className={`nav-item ${item.id === "support" ? "support-nav" : ""} ${view === item.id ? "active" : ""}`}
                        type="button"
                        key={item.id}
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

        <div className="user-card">
          <div className="avatar">
            <span>JS</span>
            <i />
          </div>
          <div>
            <strong>João Silva</strong>
            <span>Administrador</span>
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

          return (
            <button
              className={`topbar-overview-item ${itemId === "support" ? "support-topbar" : ""} ${view === itemId ? "active" : ""}`}
              type="button"
              key={itemId}
              style={
                itemId === "support"
                  ? { background: "#16b981", borderColor: "#16b981", color: "#ffffff" }
                  : undefined
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

function sumFinance(finance: FinanceEntry[], type: FinanceEntry["type"]) {
  return finance.filter((entry) => entry.type === type).reduce((sum, entry) => sum + entry.value, 0);
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
}: {
  overview: DashboardOverview | null;
  orders: Order[];
  finance: FinanceEntry[];
  inventory: InventoryItem[];
  notifications: NotificationItem[];
  sectors: Sector[];
  onOpenModal: (mode: Exclude<ModalMode, null>) => void;
  onViewChange: (view: ViewKey) => void;
}) {
  const receivable = sumFinance(finance, "receivable");
  const orderRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const revenue = (overview?.totals.revenue ?? receivable) || orderRevenue;
  const lowStock = inventory.filter((item) => item.quantity < item.minQuantity).length;
  const activeOrders = orders.filter((order) => order.status !== "delivered");
  const deliveredOrders = orders.filter((order) => order.status === "delivered").length;
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
  return (
    <section className="table-card">
      <div className="table-toolbar">
        <div>
          <strong>{orders.length} pedidos</strong>
          <span>Pipeline comercial e operacional</span>
        </div>
        <button className="primary-button" type="button" onClick={onCreateOrder}>
          <Plus size={18} />
          Novo Pedido
        </button>
      </div>
      <div className="table-scroll">
        <table>
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
            {orders.map((order) => (
              <tr
                className="clickable-row"
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
                  <strong>{order.number ?? order.id}</strong>
                </td>
                <td>{order.customer}</td>
                <td>
                  <div className="cell-stack">
                    <span>{order.product}</span>
                    <small>
                      {formatNumber(order.quantity)} un
                      {order.fractions.length ? ` · ${order.fractions.length} frações` : ""}
                    </small>
                  </div>
                </td>
                <td>
                  <StatusPill status={order.status} />
                </td>
                <td>{formatCurrency(order.total)}</td>
                <td>{order.delivery}</td>
                <td>
                  <div className="row-actions">
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
            ? orders.filter((order) => !order.stageId && order.status === stage.status)
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
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(clients.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedClients = clients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="clients-page table-card">
      <div className="table-toolbar">
        <div>
          <strong>{clients.length} clientes</strong>
          <span>Pagina com 2 linhas de 4 cards</span>
        </div>
        <button className="primary-button" type="button" onClick={onCreateClient}>
          <UserPlus size={18} />
          Novo Cliente
        </button>
      </div>
      <div className="clients-grid">
      {paginatedClients.map((client) => (
        <article className="operation-card" key={client.id}>
          <div className="card-head">
            <span>{client.company}</span>
            <ClientStatus status={client.status} />
          </div>
          <div className="client-card-identity">
            <div
              className="client-card-avatar"
              style={client.avatarUrl ? { backgroundImage: `url(${client.avatarUrl})` } : undefined}
              aria-hidden="true"
            >
              {!client.avatarUrl ? client.name.slice(0, 2).toUpperCase() : null}
            </div>
            <div>
              <h3>{client.name}</h3>
              <p>
                {client.documentType ?? "Doc."} {client.document ?? "não informado"}
              </p>
            </div>
          </div>
          <p>{client.address?.street ? `${client.address.street}, ${client.address.number}` : client.city}</p>
          <div className="contact-list">
            <span>
              <Mail size={15} />
              {client.email}
            </span>
            <span>
              <Phone size={15} />
              {client.phone}
            </span>
            {client.whatsapp ? (
              <span>
                <MessageCircle size={15} />
                {client.whatsapp}
              </span>
            ) : null}
          </div>
          <div className="metric-strip">
            <span>
              <strong>{client.orders}</strong>
              pedidos
            </span>
            <span>
              <strong>{formatCurrency(client.revenue)}</strong>
              receita
            </span>
          </div>
        </article>
      ))}
      {!paginatedClients.length ? (
        <div className="empty-state">
          <Users size={20} />
          Nenhum cliente encontrado.
        </div>
      ) : null}
      </div>
      <div className="pagination-row">
        <span>
          Pagina {currentPage} de {pageCount} - {clients.length} clientes
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

  useEffect(() => {
    if (!supportConversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(supportConversations[0]?.id ?? "");
    }
  }, [selectedConversationId, supportConversations]);

  const activeConversation =
    supportConversations.find((conversation) => conversation.id === selectedConversationId) ??
    supportConversations[0];
  const activeOrder =
    activeConversation?.order ?? orders.find((order) => order.status !== "delivered") ?? orders[0];
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

const permissionOptions: Array<{ key: string; label: string }> = [
  { key: "dashboard:read", label: "Dashboard" },
  { key: "orders:read", label: "Pedidos ver" },
  { key: "orders:write", label: "Pedidos editar" },
  { key: "production:read", label: "Producao ver" },
  { key: "production:write", label: "Producao editar" },
  { key: "clients:read", label: "Clientes ver" },
  { key: "clients:write", label: "Clientes editar" },
  { key: "products:read", label: "Produtos ver" },
  { key: "products:write", label: "Produtos editar" },
  { key: "inventory:read", label: "Estoque ver" },
  { key: "inventory:write", label: "Estoque editar" },
  { key: "machines:read", label: "Maquinas ver" },
  { key: "machines:write", label: "Maquinas editar" },
  { key: "sectors:read", label: "Setores ver" },
  { key: "sectors:write", label: "Setores editar" },
  { key: "quotes:read", label: "Orcamentos ver" },
  { key: "quotes:write", label: "Orcamentos editar" },
  { key: "finance:read", label: "Financeiro ver" },
  { key: "finance:write", label: "Financeiro editar" },
  { key: "reports:read", label: "Relatorios" },
  { key: "files:read", label: "Arquivos ver" },
  { key: "files:write", label: "Arquivos editar" },
  { key: "users:read", label: "Usuarios ver" },
  { key: "users:write", label: "Usuarios editar" },
  { key: "settings:read", label: "Configuracoes" },
];

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
  const selectedUser = selectedUserId ? users.find((user) => user.id === selectedUserId) : undefined;

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

  return (
    <section className="users-page">
      <div className="table-toolbar">
        <div>
          <strong>{users.length} usuarios</strong>
          <span>Permissoes, setores e perfis de acesso</span>
        </div>
        <button className="primary-button" type="button" onClick={onCreateUser}>
          <UserCog size={18} />
          Novo Usuario
        </button>
      </div>

      <div className="entity-list users-list">
        {users.map((user) => {
          const editing = false;
          const draft = draftForUser(user);
          const sectorNames = sectors
            .filter((sector) => user.sectorIds.includes(sector.id))
            .map((sector) => sector.name)
            .join(", ");
          const profileStatus = user.profileComplete ? "Completo" : "Pendente";

          return (
            <article className="entity-row user-row" key={user.id}>
              <div
                className="entity-avatar"
                style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
                aria-hidden="true"
              >
                {!user.avatarUrl ? user.name.slice(0, 2).toUpperCase() : null}
              </div>

              <div className="entity-copy">
                <div className="entity-line primary">
                  <div>
                    <h3>{user.name}</h3>
                    <span>{user.email}</span>
                  </div>
                  <div className="entity-pills">
                    <span>{user.type === "CLIENT" ? "Cliente" : user.type === "ADMIN" ? "Admin" : "Operador"}</span>
                    <span className={`user-status ${normalizeText(user.status)}`}>{user.status}</span>
                  </div>
                </div>
                <div className="entity-line secondary">
                  <span><ShieldCheck size={14} /> {user.role}</span>
                  <span><Phone size={14} /> {user.phone || "Nao informado"}</span>
                  <span><Building2 size={14} /> {user.department || user.jobTitle || "Sem cargo"}</span>
                  <span><Layers3 size={14} /> {sectorNames || "Sem setor vinculado"}</span>
                  <span><Clock3 size={14} /> Cadastro {user.createdAt || "sem data"}</span>
                  <span><CheckCircle2 size={14} /> {profileStatus}</span>
                </div>
              </div>
              <div className="card-head">
                <span>{user.type === "CLIENT" ? "Cliente" : user.type === "ADMIN" ? "Admin" : "Operador"}</span>
                <ClientStatus status={user.status === "Ativo" ? "Ativo" : user.status === "Suspenso" ? "Inativo" : "Atenção"} />
              </div>

              <div className="client-card-identity">
                <div
                  className="client-card-avatar"
                  style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
                  aria-hidden="true"
                >
                  {!user.avatarUrl ? user.name.slice(0, 2).toUpperCase() : null}
                </div>
                <div>
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                </div>
              </div>

              <div className="settings-list compact">
                <SettingsLine icon={ShieldCheck} label="Perfil" value={user.role} />
                <SettingsLine icon={Phone} label="Telefone" value={user.phone || "Nao informado"} />
                <SettingsLine icon={FileText} label="Documento" value={user.document || "Nao informado"} />
              </div>

              {editing ? (
                <div className="user-permission-editor">
                  <div className="field-grid three">
                    <TextField label="Nome" value={String(draft.name ?? "")} onChange={(value) => updateDraft(user, { name: value })} />
                    <TextField label="E-mail" type="email" value={String(draft.email ?? "")} onChange={(value) => updateDraft(user, { email: value })} />
                    <TextField label="Telefone" value={String(draft.phone ?? "")} onChange={(value) => updateDraft(user, { phone: value })} />
                    <TextField label="Documento" value={String(draft.document ?? "")} onChange={(value) => updateDraft(user, { document: value })} />
                    <TextField label="Imagem" value={String(draft.avatarUrl ?? "")} onChange={(value) => updateDraft(user, { avatarUrl: value })} />
                    <label>
                      Tipo
                      <select
                        value={draft.type ?? user.type}
                        onChange={(event) => updateDraft(user, { type: event.target.value as UserAccount["type"] })}
                      >
                        <option value="OPERATOR">Operador</option>
                        <option value="CLIENT">Cliente</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </label>
                    <label>
                      Perfil
                      <select
                        value={draft.role ?? user.role}
                        onChange={(event) => updateDraft(user, { role: event.target.value as UserAccount["role"] })}
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
                      Status
                      <select
                        value={draft.status ?? user.status}
                        onChange={(event) => updateDraft(user, { status: event.target.value as UserAccount["status"] })}
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Convidado">Convidado</option>
                        <option value="Suspenso">Suspenso</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </label>
                  </div>

                  <div className="permission-chip-grid">
                    {permissionOptions.map((permission) => {
                      const active = (draft.permissions ?? user.permissions).includes(permission.key);
                      return (
                        <button
                          className={`permission-chip ${active ? "active" : ""}`}
                          type="button"
                          key={permission.key}
                          onClick={() =>
                            updateDraft(user, {
                              permissions: active
                                ? (draft.permissions ?? user.permissions).filter((item) => item !== permission.key)
                                : [...(draft.permissions ?? user.permissions), permission.key],
                            })
                          }
                        >
                          {active ? <Check size={14} /> : <Plus size={14} />}
                          {permission.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="permission-chip-grid">
                    {sectors.map((sector) => {
                      const active = (draft.sectorIds ?? user.sectorIds).includes(sector.id);
                      return (
                        <button
                          className={`permission-chip sector ${active ? "active" : ""}`}
                          type="button"
                          key={sector.id}
                          onClick={() =>
                            updateDraft(user, {
                              sectorIds: active
                                ? (draft.sectorIds ?? user.sectorIds).filter((item) => item !== sector.id)
                                : [...(draft.sectorIds ?? user.sectorIds), sector.id],
                            })
                          }
                        >
                          {active ? <Check size={14} /> : <Layers3 size={14} />}
                          {sector.name}
                        </button>
                      );
                    })}
                  </div>

                  <form
                    className="user-password-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const password = passwordDraft.trim();
                      if (!password) return;
                      await onUpdatePassword(user.id, password);
                      setPasswordDraft("");
                    }}
                  >
                    <input
                      value={passwordDraft}
                      minLength={8}
                      placeholder="Nova senha temporaria"
                      type="password"
                      onChange={(event) => setPasswordDraft(event.target.value)}
                    />
                    <button className="ghost-button compact" type="submit">
                      <LockKeyhole size={16} />
                      Trocar senha
                    </button>
                  </form>
                  <div className="inline-actions">
                    <button className="primary-button compact" type="button" onClick={() => void saveUser(user)}>
                      <Save size={16} />
                      Salvar usuario
                    </button>
                    <button className="ghost-button compact" type="button" onClick={() => setSelectedUserId(null)}>
                      <X size={16} />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="entity-actions">
                <button
                  className="ghost-button compact"
                  type="button"
                  onClick={() => {
                    setUserDrafts((current) => ({ ...current, [user.id]: userEditDraft(user) }));
                    setPasswordDraft("");
                    setSelectedUserId(user.id);
                  }}
                >
                  <Pencil size={16} />
                  Editar
                </button>
                <button
                  className="icon-button danger-action"
                  type="button"
                  aria-label={`Excluir ${user.name}`}
                  title="Excluir usuario"
                  onClick={() => void onDeleteUser(user.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
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

  function togglePermission(permission: string) {
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
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const uploaded = await onUploadFile(file, "users");
                  onDraftChange({ avatarUrl: uploaded.url });
                  event.currentTarget.value = "";
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
  return (
    <section className="table-card">
      <div className="table-toolbar">
        <div>
          <strong>{products.length} produtos</strong>
          <span>Catálogo operacional da gráfica</span>
        </div>
        <button className="primary-button" type="button" onClick={onCreateProduct}>
          <Plus size={18} />
          Novo Produto
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Setor</th>
              <th>Preço</th>
              <th>Mínimo</th>
              <th>Frações</th>
              <th>Estoque</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <strong>{product.name}</strong>
                </td>
                <td>{product.category}</td>
                <td>{product.sector}</td>
                <td>{formatCurrency(product.price)}</td>
                <td>{formatNumber(product.minOrderQty)}</td>
                <td>{product.allowsFractions ? `${formatNumber(product.minFractionQty)}+` : "Não"}</td>
                <td>{product.stockItem}</td>
                <td>
                  <div className="row-actions">
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CatalogView({
  products,
  onSelectProduct,
}: {
  products: Product[];
  onSelectProduct: (productId: string) => void;
}) {
  return (
    <section className="catalog-grid">
      {products.map((product) => (
        <article className="catalog-card" key={product.id}>
          <div className="product-visual" style={{ "--visual": visualColor(product.category) } as CSSProperties}>
            <Package size={38} />
          </div>
          <h3>{product.name}</h3>
          <p>{product.category} · {product.sector}</p>
          <div className="catalog-meta">
            <span>{formatCurrency(product.price)}</span>
            <span>{product.leadTime}</span>
            <span>{product.allowsFractions ? "Fraciona" : "Sem frações"}</span>
          </div>
          <button className="primary-button wide" type="button" onClick={() => onSelectProduct(product.id)}>
            <ShoppingBag size={18} />
            Montar Pedido
          </button>
        </article>
      ))}
    </section>
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
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const uploaded = await onUploadFile(file, "inventory");
                      updateDraft(item, { imageUrl: uploaded.url });
                      event.currentTarget.value = "";
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
  const openOrders = relatedOrders.filter((order) => order.status !== "delivered");
  const closedOrders = relatedOrders.filter((order) => order.status === "delivered");
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

function SectorsView({
  sectors,
  products,
  onUpdateSector,
  onDeleteSector,
  onLinkProduct,
}: {
  sectors: Sector[];
  products: Product[];
  onUpdateSector: (
    sectorId: string,
    update: Partial<Pick<Sector, "name" | "capacity" | "sla" | "lead">>,
  ) => void;
  onDeleteSector: (sectorId: string) => void;
  onLinkProduct: (productId: string, sectorId: string) => void;
}) {
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});

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
    <section className="table-card sector-management-card">
      <div className="table-toolbar">
        <div>
          <strong>{sectors.length} setores</strong>
          <span>Capacidade, SLA e cadastros vinculados por área produtiva</span>
        </div>
      </div>

      <div className="sector-management-grid">
        {sectors.map((sector) => {
          const linkedProducts = products.filter((product) => product.sector === sector.name);
          const availableProducts = products.filter((product) => product.sector !== sector.name);
          const selectedProductId = linkDraft[sector.id] ?? availableProducts[0]?.id ?? "";
          const isEditing = editingSector?.id === sector.id;

          return (
            <article className="operation-card sector-card" key={sector.id}>
              <div className="card-head">
                <span>{sector.orders} pedidos</span>
                <div className="card-actions">
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
                  <h3>{sector.name}</h3>
                  <p>Lead médio {sector.lead} · SLA {sector.sla}</p>
                  <ProgressBar value={sector.capacity} color="#5b45ff" />
                  <div className="metric-strip">
                    <span>
                      <strong>{sector.capacity}%</strong>
                      capacidade
                    </span>
                    <span>
                      <strong>{linkedProducts.length}</strong>
                      cadastros
                    </span>
                  </div>

                  <div className="linked-products">
                    <strong>Cadastros vinculados</strong>
                    {linkedProducts.length ? (
                      <div>
                        {linkedProducts.slice(0, 5).map((product) => (
                          <span key={product.id}>{product.name}</span>
                        ))}
                      </div>
                    ) : (
                      <p>Nenhum cadastro vinculado.</p>
                    )}
                  </div>

                  <div className="sector-link-row">
                    <select
                      aria-label={`Vincular cadastro ao setor ${sector.name}`}
                      value={selectedProductId}
                      onChange={(event) =>
                        setLinkDraft((current) => ({
                          ...current,
                          [sector.id]: event.target.value,
                        }))
                      }
                    >
                      {availableProducts.length ? (
                        availableProducts.map((product) => (
                          <option value={product.id} key={product.id}>
                            {product.name}
                          </option>
                        ))
                      ) : (
                        <option value="">Sem cadastros livres</option>
                      )}
                    </select>
                    <button
                      className="ghost-button compact"
                      type="button"
                      disabled={!selectedProductId}
                      onClick={() => {
                        if (!selectedProductId) {
                          return;
                        }

                        onLinkProduct(selectedProductId, sector.id);
                        setLinkDraft((current) => ({ ...current, [sector.id]: "" }));
                      }}
                    >
                      <Package size={16} />
                      Vincular
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function QuotesView({
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

  function publicQuoteLink(quote: Quote) {
    if (quote.publicToken.startsWith("http")) return quote.publicToken;
    if (!quote.publicToken) return "";
    return `${window.location.origin}/orcamento/${quote.id}?token=${encodeURIComponent(quote.publicToken)}`;
  }

  return (
    <section className="quote-page">
      <div className="quote-header">
        <div className="quote-title">
          <span>
            <FileText size={25} />
          </span>
          <div>
            <h1>Novo Orçamento</h1>
            <p>Monte propostas, gere PDF e envie link público para aceite.</p>
          </div>
        </div>
        <div className="quote-header-actions">
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
                  <input value="#1001" readOnly />
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
  if (product.id === "prod-cartoes") return "/assets/category-business-cards.jpg";
  if (product.id === "prod-banners") return "/assets/category-banners.jpg";
  if (product.id === "prod-adesivos") return "/assets/category-folders.jpg";
  if (product.id === "prod-canetas") return "/assets/category-mugs.jpg";
  return inventoryImages[product.stockItem] ?? "/assets/category-packages.jpg";
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
  onCreateExpense,
  onScheduleCharge,
  onSendReminder,
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
  const profit = finance.find((entry) => entry.type === "profit")?.value ?? 0;
  const margin = finance.find((entry) => entry.type === "margin")?.value ?? 0;
  const cash = finance.find((entry) => entry.type === "cash")?.value ?? 0;
  const balance = receivable - payable;
  const projectedCash = cash + balance;
  const financeReport = [
    "Conta;Tipo;Valor;Status;Vencimento",
    ...finance.map((entry) => `${entry.label};${entry.type};${entry.type === "margin" ? `${entry.value}%` : formatCurrency(entry.value)};${entry.status};${entry.due}`),
    `Saldo projetado;cash;${formatCurrency(projectedCash)};Projetado;30 dias`,
  ].join("\n");
  const forecastItems = [
    { label: "Hoje", value: cash, tone: "#5b45ff" },
    { label: "7 dias", value: cash + receivable * 0.35 - payable * 0.2, tone: "#0a84ff" },
    { label: "15 dias", value: cash + receivable * 0.68 - payable * 0.55, tone: "#ff7a00" },
    { label: "30 dias", value: projectedCash, tone: projectedCash >= 0 ? "#16b981" : "#ee3045" },
  ];
  const cashFlowSeries = chartSeries(forecastItems.map((item) => item.value));
  const breakdown = [
    { label: "Receber", value: receivable, percent: 100, color: "#16b981" },
    { label: "Pagar", value: payable, percent: Math.round((payable / Math.max(receivable, 1)) * 100), color: "#ee3045" },
    { label: "Lucro", value: profit, percent: Math.round((profit / Math.max(receivable, 1)) * 100), color: "#5b45ff" },
    { label: "Caixa", value: cash, percent: Math.round((cash / Math.max(receivable, 1)) * 100), color: "#0a84ff" },
  ];

  return (
    <section className="finance-page">
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

function ReportsView({
  orders,
  finance,
  sectors,
}: {
  orders: Order[];
  finance: FinanceEntry[];
  sectors: Sector[];
}) {
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const averageTicket = totalRevenue / Math.max(orders.length, 1);
  const deliveredOrders = orders.filter((order) => order.status === "delivered").length;
  const openOrders = orders.length - deliveredOrders;
  const averageProgress = Math.round(
    orders.reduce((sum, order) => sum + order.progress, 0) / Math.max(orders.length, 1),
  );
  const averageCapacity = Math.round(
    sectors.reduce((sum, sector) => sum + sector.capacity, 0) / Math.max(sectors.length, 1),
  );
  const receivable = finance.find((entry) => entry.type === "receivable")?.value ?? 0;
  const payable = finance.find((entry) => entry.type === "payable")?.value ?? 0;
  const profit = finance.find((entry) => entry.type === "profit")?.value ?? 0;
  const margin = finance.find((entry) => entry.type === "margin")?.value ?? 0;
  const cash = finance.find((entry) => entry.type === "cash")?.value ?? 0;
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
                      const selected = event.target.files?.[0];
                      if (!selected) return;
                      const uploaded = await onUploadFile(selected, "files");
                      setDrafts((current) => ({
                        ...current,
                        [file.id]: {
                          ...current[file.id],
                          name: current[file.id]?.name ?? uploaded.name,
                          url: uploaded.url,
                          size: `${(uploaded.size / 1024 / 1024).toFixed(2)} MB`,
                        },
                      }));
                      event.currentTarget.value = "";
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
  return (
    <section className="settings-grid">
      <SectionCard title="Conta">
        <div className="settings-list">
          <SettingsLine icon={ShieldCheck} label="Tenant" value="GraphFlow Matriz" />
          <SettingsLine icon={Users} label="Perfil" value="Administrador" />
          <SettingsLine icon={Building2} label="Unidade" value="São Paulo" />
        </div>
      </SectionCard>

      <SectionCard title="Segurança">
        <div className="settings-list">
          <SettingsLine icon={LockKeyhole} label="MFA TOTP" value="Obrigatório" />
          <SettingsLine icon={BellRing} label="Alertas críticos" value="Ativos" />
          <SettingsLine icon={Eye} label="Auditoria" value="30 dias" />
        </div>
      </SectionCard>

      <SectionCard title="Preferências">
        <div className="settings-actions">
          <button className="ghost-button compact" type="button" onClick={onToggleTheme}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            Tema
          </button>
          <button className="ghost-button compact" type="button" onClick={onRefreshData}>
            <RefreshCw size={16} />
            Atualizar dados
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Autenticação">
        <div className="settings-list">
          <SettingsLine icon={LockKeyhole} label="Provedor" value="Keycloak OIDC" />
          <SettingsLine icon={ShieldCheck} label="Sessão" value="Cookie httpOnly + SameSite" />
          <SettingsLine icon={UserCog} label="Permissões" value="Por usuário e setor" />
        </div>
      </SectionCard>

      <SectionCard title="Operação">
        <div className="settings-list">
          <SettingsLine icon={Factory} label="Kanban" value="Sincronizado com setores" />
          <SettingsLine icon={Cpu} label="Máquinas" value="Uso por pedidos" />
          <SettingsLine icon={Boxes} label="Estoque" value="Mínimos, imagens e movimentações" />
        </div>
      </SectionCard>

      <SectionCard title="Comercial">
        <div className="settings-list">
          <SettingsLine icon={FileText} label="Orçamentos" value="PDF, link público e aceite" />
          <SettingsLine icon={Link2} label="Links públicos" value="Token com expiração" />
          <SettingsLine icon={MessageCircle} label="Notificações" value="Painel interno" />
        </div>
      </SectionCard>

      <SectionCard title="Financeiro e Arquivos">
        <div className="settings-list">
          <SettingsLine icon={WalletCards} label="Lançamentos" value="Pagar, receber e custos vinculados" />
          <SettingsLine icon={Folder} label="Arquivos" value="Anexos por pedido, produto e financeiro" />
          <SettingsLine icon={Download} label="Exportações" value="CSV e relatórios" />
        </div>
      </SectionCard>
    </section>
  );
}

function OrderForm({
  clients,
  products,
  draft,
  selectedProduct,
  orderTotal,
  fractionTotal,
  validation,
  onUploadFile,
  onDraftChange,
  onSubmit,
}: {
  clients: Client[];
  products: Product[];
  draft: NewOrderDraft;
  selectedProduct: Product | undefined;
  orderTotal: number;
  fractionTotal: number;
  validation: string | null;
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onDraftChange: (draft: NewOrderDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function updateFraction(index: number, update: Partial<Fraction>) {
    onDraftChange({
      ...draft,
      fractions: draft.fractions.map((fraction, currentIndex) =>
        currentIndex === index ? { ...fraction, ...update } : fraction,
      ),
    });
  }

  function addFraction() {
    onDraftChange({
      ...draft,
      fractions: [
        ...draft.fractions,
        {
          id: `fraction-${Date.now()}`,
          quantity: selectedProduct?.minFractionQty ?? 50,
          color: firstProductColor(selectedProduct),
          note: "",
        },
      ],
    });
  }

  function removeFraction(index: number) {
    onDraftChange({
      ...draft,
      fractions: draft.fractions.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <ModalHeader icon={ClipboardList} title="Novo Pedido" subtitle="Pedido com fracionamento validado." />

      <div className="form-grid">
        <label>
          Cliente
          <select
            data-testid="customer-search"
            value={draft.customerId}
            onChange={(event) => onDraftChange({ ...draft, customerId: event.target.value })}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} · {client.company}
              </option>
            ))}
          </select>
        </label>
        <label>
          Produto
          <select
            data-testid="product-search"
            value={draft.productId}
            onChange={(event) => {
              const product = products.find((item) => item.id === event.target.value);
              const color = firstProductColor(product);
              onDraftChange({
                ...draft,
                productId: event.target.value,
                quantity: product?.minOrderQty ?? draft.quantity,
                fractions: product?.allowsFractions
                  ? [
                      {
                        id: "fraction-1",
                        quantity: product.minFractionQty,
                        color,
                        note: "",
                      },
                    ]
                  : [],
              });
            }}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantidade
          <input
            data-testid="item-quantity"
            min={1}
            value={draft.quantity}
            type="number"
            onChange={(event) => onDraftChange({ ...draft, quantity: Number(event.target.value) })}
          />
        </label>
        <label>
          Entrega
          <input
            value={draft.deliveryDate}
            type="date"
            min={todayInputDate()}
            onChange={(event) => onDraftChange({ ...draft, deliveryDate: event.target.value })}
          />
        </label>
        <label>
          Arte do produto
          <span className="upload-field">
            <Upload size={16} />
            <span>{draft.artFileUrl ? draft.artFileName || "Arte enviada" : "Selecionar arte"}</span>
            <input
              type="file"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await onUploadFile(file, "orders");
                onDraftChange({ ...draft, artFileName: uploaded.name, artFileUrl: uploaded.url });
                event.currentTarget.value = "";
              }}
            />
          </span>
        </label>
      </div>

      {selectedProduct?.allowsFractions ? (
        <div className="fraction-builder" data-testid="fraction-builder">
          <div className="fraction-head">
            <div>
              <strong>Frações</strong>
              <span>
                {formatNumber(fractionTotal)} / {formatNumber(draft.quantity)}
              </span>
            </div>
            <button className="ghost-button compact" type="button" onClick={addFraction} data-testid="add-fraction">
              <Plus size={16} />
              Fração
            </button>
          </div>
          <div
            className={`fraction-progress ${validation ? "invalid" : "valid"}`}
            data-testid="fraction-progress"
          >
            <span style={{ width: `${Math.min(100, (fractionTotal / Math.max(draft.quantity, 1)) * 100)}%` }} />
          </div>
          <div className="fraction-list">
            {draft.fractions.map((fraction, index) => (
              <div className="fraction-row" key={fraction.id}>
                <input
                  data-testid={`fraction-${index}-quantity`}
                  min={0}
                  value={fraction.quantity}
                  type="number"
                  onChange={(event) => updateFraction(index, { quantity: Number(event.target.value) })}
                />
                {selectedProduct?.availableColors?.length ? (
                  <select
                    data-testid={`fraction-${index}-cor`}
                    value={fraction.color || firstProductColor(selectedProduct)}
                    onChange={(event) => updateFraction(index, { color: event.target.value })}
                  >
                    {selectedProduct.availableColors.map((color) => (
                      <option value={color} key={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    data-testid={`fraction-${index}-cor`}
                    value={fraction.color}
                    placeholder="Cor"
                    onChange={(event) => updateFraction(index, { color: event.target.value })}
                  />
                )}
                <input
                  value={fraction.note}
                  placeholder="Observação"
                  onChange={(event) => updateFraction(index, { note: event.target.value })}
                />
                <button className="icon-button" type="button" onClick={() => removeFraction(index)} aria-label="Remover fração" title="Remover fração">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {validation ? (
            <p className="form-error" data-testid="fraction-error">
              {validation}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="modal-total">
        <span>Total estimado</span>
        <strong>{formatCurrency(orderTotal)}</strong>
      </div>
      <button className="primary-button wide" type="submit" disabled={Boolean(validation)} data-testid="add-to-cart">
        <Send size={18} />
        Criar Pedido
      </button>
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
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await onUploadFile(file, "clients");
                onDraftChange({ ...draft, avatarUrl: uploaded.url });
                event.currentTarget.value = "";
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
  function togglePermission(permission: string) {
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
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await onUploadFile(file, "users");
                onDraftChange({ ...draft, avatarUrl: uploaded.url });
                event.currentTarget.value = "";
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
  title: string;
  subtitle: string;
  submitLabel: string;
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onDraftChange: (draft: ProductDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <ModalHeader icon={Package} title={title} subtitle={subtitle} />
      <div className="form-grid">
        <TextField label="Nome" value={draft.name} onChange={(name) => onDraftChange({ ...draft, name })} required />
        <TextField label="Categoria" value={draft.category} onChange={(category) => onDraftChange({ ...draft, category })} required />
        <label>
          Imagem do produto
          <span className="upload-field">
            <Upload size={16} />
            <span>{draft.thumbnailUrl ? "Imagem enviada" : "Selecionar imagem"}</span>
            <input
              accept="image/*"
              type="file"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await onUploadFile(file, "products");
                onDraftChange({ ...draft, thumbnailUrl: uploaded.url });
                event.currentTarget.value = "";
              }}
            />
          </span>
        </label>
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
          Item de estoque
          <select value={draft.stockItem} onChange={(event) => onDraftChange({ ...draft, stockItem: event.target.value })}>
            {inventory.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <NumberField label="Preço" value={draft.price} onChange={(price) => onDraftChange({ ...draft, price })} />
        <NumberField label="Mínimo pedido" value={draft.minOrderQty} onChange={(minOrderQty) => onDraftChange({ ...draft, minOrderQty })} />
        <NumberField label="Mínimo fração" value={draft.minFractionQty} onChange={(minFractionQty) => onDraftChange({ ...draft, minFractionQty })} />
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
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await onUploadFile(file, "files");
                onDraftChange({ ...draft, name: draft.name || uploaded.name, url: uploaded.url });
                event.currentTarget.value = "";
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

function OrderDetail({
  order,
  files,
  products,
  machines,
  sectors,
  users,
  onUploadFile,
  onSave,
  onAddArtFile,
}: {
  order: Order;
  files: FileItem[];
  products: Product[];
  machines: Machine[];
  sectors: Sector[];
  users: UserAccount[];
  onUploadFile: (file: File, scope: UploadScope) => Promise<UploadedFile>;
  onSave: (orderId: string, update: OrderEditDraft & { clientEmail?: string; clientPhone?: string; clientDocument?: string }) => void | Promise<void>;
  onAddArtFile: (order: Order, input: { productName: string; name: string; url: string }) => void | Promise<void>;
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
    const haystack = normalizeText(`${file.linkedTo} ${file.name}`);
    return haystack.includes(normalizeText(order.number ?? order.id)) || haystack.includes(normalizeText(order.id));
  });
  const artFiles = [
    ...(order.artFiles ?? []),
    ...linkedFiles.map((file) => ({
      id: file.id,
      productName: file.linkedTo,
      name: file.name,
      url: file.url ?? "",
      size: file.size,
    })),
  ];
  const [shareFeedback, setShareFeedback] = useState("");
  const receiptNumber = order.number ?? order.id;

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
      <ModalHeader icon={ClipboardList} title={`Pedido ${order.number ?? order.id}`} subtitle="Detalhes do pedido em produção." />
      <section className="order-receipt-card">
        <div className="order-receipt-top">
          <div>
            <span>Recibo do pedido</span>
            <h2>{receiptNumber}</h2>
            <p>{statusMeta[order.status].label}</p>
          </div>
          <div className="order-receipt-actions">
            <button className="ghost-button compact" type="button" onClick={handlePrintReceipt}>
              <Download size={16} />
              PDF
            </button>
            <button className="primary-button compact" type="button" onClick={() => void handleShareReceipt()}>
              <Send size={16} />
              Compartilhar
            </button>
          </div>
        </div>

        <div className="order-receipt-customer">
          <div>
            <span>Cliente</span>
            <strong>{order.customer}</strong>
          </div>
          <div>
            <span>Entrega</span>
            <strong>{order.delivery}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{formatCurrency(order.total)}</strong>
          </div>
        </div>

        <div className="order-receipt-items">
          <div className="order-receipt-item head">
            <span>Item</span>
            <span>Qtd.</span>
            <span>Setor</span>
            <span>Total</span>
          </div>
          <div className="order-receipt-item">
            <strong>{order.product}</strong>
            <span>{formatNumber(order.quantity)} un</span>
            <span>{order.sector}</span>
            <strong>{formatCurrency(order.total)}</strong>
          </div>
        </div>

        {artFiles.length ? (
          <div className="order-receipt-files">
            <span>Arquivos do pedido</span>
            <div>
              {artFiles.slice(0, 4).map((file) => (
                <button
                  className="ghost-button compact"
                  key={file.id}
                  type="button"
                  disabled={!file.url}
                  onClick={() => file.url && window.open(file.url, "_blank", "noopener,noreferrer")}
                >
                  <Download size={15} />
                  {file.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {shareFeedback ? <small className="order-share-feedback">{shareFeedback}</small> : null}
      </section>
      <div className="order-detail-head">
        <div>
          <span>Cliente</span>
          <strong>{order.customer}</strong>
        </div>
        <StatusPill status={order.status} />
      </div>
      <div className="order-detail-grid">
        <SettingsLine icon={Package} label="Produto" value={order.product} />
        <SettingsLine icon={Factory} label="Setor" value={order.sector} />
        <SettingsLine icon={CalendarDays} label="Entrega" value={order.delivery} />
        <SettingsLine icon={ShoppingBag} label="Quantidade" value={`${formatNumber(order.quantity)} un`} />
        <SettingsLine icon={CircleDollarSign} label="Total" value={formatCurrency(order.total)} />
        <SettingsLine icon={ArrowUpRight} label="Prioridade" value={order.priority} />
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
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await onUploadFile(file, "orders");
                setArtDraft({ ...artDraft, name: artDraft.name || uploaded.name, url: uploaded.url });
                event.currentTarget.value = "";
              }}
            />
          </label>
          <button className="ghost-button compact" type="submit">
            <Upload size={15} />
            Anexar
          </button>
        </form>
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
        width={compact ? 160 : 220}
        height={compact ? 42 : 64}
        className={compact ? "brand-logo-compact" : "brand-logo-image"}
        style={{ width: compact ? 160 : 220, height: compact ? 42 : 64, objectFit: "contain" }}
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

function Modal({
  mode,
  children,
  onClose,
}: {
  mode: ModalMode;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!mode) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <button className="modal-scrim" type="button" aria-label="Fechar modal" onClick={onClose} />
      <div className="modal-panel">
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
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="modal-header">
      <span>
        <Icon size={22} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
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
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
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
      <input min={0} step="any" value={value} type="number" onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const meta = statusMeta[status];
  return (
    <span className="status-pill" style={{ "--status": meta.color, "--status-bg": meta.bg } as CSSProperties} data-testid="order-status">
      {meta.label}
    </span>
  );
}

function PriorityTag({ priority }: { priority: Order["priority"] }) {
  return <span className={`priority-tag ${normalizeText(priority)}`}>{priority}</span>;
}

function ClientStatus({ status }: { status: Client["status"] }) {
  return <span className={`client-status ${normalizeText(status)}`}>{status}</span>;
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
