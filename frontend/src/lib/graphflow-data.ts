export type ViewKey =
  | "dashboard"
  | "orders"
  | "production"
  | "clients"
  | "users"
  | "support"
  | "products"
  | "catalog"
  | "landing"
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
  | "delivered"
  | "canceled";

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

export type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sector: string;
  sectorId?: string;
  machineId?: string;
  assignedUserId?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  artFiles?: OrderArtFile[];
};

export type Order = {
  id: string;
  number?: string;
  publicOrderId?: string;
  publicToken?: string;
  publicLink?: string;
  publicLinkExpiresAt?: string;
  publicLinkAcceptedAt?: string;
  itemId?: string;
  customer: string;
  customerId?: string;
  product: string;
  productId: string;
  sector: string;
  createdAt?: string;
  time?: string;
  machineId?: string;
  responsible?: string;
  quantity: number;
  total: number;
  paymentStatus?: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "REFUNDED" | "CANCELED";
  paidAmount?: number;
  remainingAmount?: number;
  status: OrderStatus;
  stageId?: string;
  progress: number;
  delivery: string;
  dueDate: string;
  priority: Priority;
  fractions: Fraction[];
  artFiles?: OrderArtFile[];
  items?: OrderItem[];
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

import type { AnyPermission } from "../shared/permissions";
import type { LandingIconKey } from "./landing-icons";

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
  permissions: AnyPermission[];
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
  machineId?: string;
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
  skipFiscalData?: boolean;
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

export type LandingLink = {
  label: string;
  href: string;
};

export type LandingHeroSlide = {
  id: string;
  imageUrl: string;
  alt: string;
  active: boolean;
};

export type LandingFeature = {
  id: string;
  icon: LandingIconKey;
  title: string;
  text: string;
  active: boolean;
};

export type LandingCategory = {
  id: string;
  title: string;
  price: string;
  imageUrl: string;
  active: boolean;
};

export type LandingProductCard = {
  id: string;
  tag: string;
  imageUrl: string;
  title: string;
  specs: string;
  oldPrice: string;
  price: string;
  reviews: string;
  active: boolean;
};

export type LandingBenefit = {
  id: string;
  icon: LandingIconKey;
  label: string;
  title: string;
  text: string;
  active: boolean;
};

export type LandingTestimonial = {
  id: string;
  name: string;
  role: string;
  text: string;
  initials: string;
  active: boolean;
};

export type LandingFooterColumn = {
  id: string;
  title: string;
  items: string[];
  active: boolean;
};

export type LandingPageConfig = {
  brand: {
    name: string;
    tagline: string;
    logoUrl: string;
  };
  topStrip: {
    welcome: string;
    phone: string;
    email: string;
    links: LandingLink[];
  };
  navigation: LandingLink[];
  hero: {
    titlePrefix: string;
    titleHighlight: string;
    description: string;
    primaryCta: LandingLink;
    secondaryCta: LandingLink;
    slides: LandingHeroSlide[];
    features: LandingFeature[];
  };
  process: LandingFeature[];
  categories: LandingCategory[];
  products: LandingProductCard[];
  benefits: LandingBenefit[];
  testimonials: LandingTestimonial[];
  newsletter: {
    title: string;
    subtitle: string;
    whatsapp: string;
    message: string;
  };
  footer: {
    description: string;
    columns: LandingFooterColumn[];
    copyright: string;
    developer: string;
  };
  whatsappUrl: string;
};

export const defaultLandingPageConfig: LandingPageConfig = {
  brand: {
    name: "Grafica Exemplo",
    tagline: "Impressao de qualidade",
    logoUrl: "/assets/d2513524-f181-4a63-9fff-94a95de5aacf.png",
  },
  topStrip: {
    welcome: "Bem-vindo a Grafica Exemplo!",
    phone: "(11) 99999-9999",
    email: "contato@graficaexemplo.com.br",
    links: [
      { label: "Sobre nos", href: "#sobre" },
      { label: "Como funciona", href: "#como-funciona" },
      { label: "Meus pedidos", href: "#pedidos" },
      { label: "Fale conosco", href: "#contato" },
    ],
  },
  navigation: [
    { label: "Inicio", href: "/" },
    { label: "Todos os Produtos", href: "/produtos" },
    { label: "Personalizados", href: "/personalizados" },
    { label: "Promocoes", href: "/promocoes" },
    { label: "Novidades", href: "/novidades" },
    { label: "Catalogo Online", href: "/catalogo" },
    { label: "Upload de Arte", href: "/upload" },
  ],
  hero: {
    titlePrefix: "Solucoes graficas",
    titleHighlight: "para impulsionar\nseu negocio",
    description: "Da criacao a impressao, entregamos qualidade, agilidade e acabamento impecavel.",
    primaryCta: { label: "Conheca nossos produtos", href: "/produtos" },
    secondaryCta: { label: "Fazer orcamento", href: "https://wa.me/5511999999999" },
    slides: [
      { id: "hero-design", imageUrl: "/assets/hero-design-studio.jpg", alt: "Estudio de design grafico", active: true },
      { id: "hero-print", imageUrl: "/assets/hero-print-machine.jpg", alt: "Maquina de impressao", active: true },
    ],
    features: [
      { id: "quality", icon: "quality", title: "Qualidade Garantida", text: "Materiais de primeira linha", active: true },
      { id: "delivery", icon: "delivery", title: "Entrega Rapida", text: "Para todo o Brasil", active: true },
      { id: "support", icon: "support", title: "Atendimento Especializado", text: "Suporte via WhatsApp", active: true },
      { id: "payment", icon: "payment", title: "Pagamento Seguro", text: "Seus dados protegidos", active: true },
    ],
  },
  process: [
    { id: "upload", icon: "upload", title: "Envie sua arte", text: "Faca upload do seu arquivo nos formatos: PDF, CDR, AI, PSD, PNG", active: true },
    { id: "customize", icon: "settings", title: "Personalize", text: "Escolha as opcoes do produto e personalize do seu jeito", active: true },
    { id: "receive", icon: "package", title: "Receba em casa", text: "Entregamos para todo o Brasil com seguranca e agilidade", active: true },
  ],
  categories: [
    { id: "business-cards", title: "Cartoes de Visita", price: "A partir de R$ 29,90", imageUrl: "/assets/category-business-cards.jpg", active: true },
    { id: "folders", title: "Folders", price: "A partir de R$ 99,90", imageUrl: "/assets/category-folders.jpg", active: true },
    { id: "banners", title: "Banners", price: "A partir de R$ 59,90", imageUrl: "/assets/category-banners.jpg", active: true },
    { id: "stickers", title: "Adesivos", price: "A partir de R$ 49,90", imageUrl: "/assets/category-stickers.jpg", active: true },
    { id: "invites", title: "Convites", price: "A partir de R$ 89,90", imageUrl: "/assets/category-invites.jpg", active: true },
    { id: "gifts", title: "Brindes", price: "A partir de R$ 19,90", imageUrl: "/assets/category-mugs.jpg", active: true },
    { id: "packages", title: "Embalagens", price: "A partir de R$ 129,90", imageUrl: "/assets/category-packages.jpg", active: true },
    { id: "plates", title: "Placas", price: "A partir de R$ 69,90", imageUrl: "/assets/category-plates.jpg", active: true },
  ],
  products: [
    { id: "card-300g", tag: "MAIS VENDIDO", imageUrl: "/assets/category-business-cards.jpg", title: "Cartao de Visita Couche 300g", specs: "4x0 cores - Verniz Total Frente", oldPrice: "", price: "R$ 29,90", reviews: "124", active: true },
    { id: "folder-150g", tag: "15% OFF", imageUrl: "/assets/category-folders.jpg", title: "Folder Couche 150g", specs: "15x21cm - 4x4 cores - Verniz Total", oldPrice: "R$ 129,90", price: "R$ 109,90", reviews: "86", active: true },
    { id: "sticker-round", tag: "NOVO", imageUrl: "/assets/category-stickers.jpg", title: "Adesivo Redondo", specs: "5x5cm - Vinil - 4x0 cores", oldPrice: "", price: "R$ 49,90", reviews: "53", active: true },
    { id: "banner-440g", tag: "MAIS VENDIDO", imageUrl: "/assets/category-banners.jpg", title: "Banner Lona 440g", specs: "80x120cm - 4x0 cores", oldPrice: "", price: "R$ 59,90", reviews: "71", active: true },
    { id: "mug-custom", tag: "10% OFF", imageUrl: "/assets/category-mugs.jpg", title: "Caneca Personalizada", specs: "Ceramica - 325ml - 4x0 cores", oldPrice: "R$ 39,90", price: "R$ 35,90", reviews: "37", active: true },
    { id: "box-custom", tag: "NOVO", imageUrl: "/assets/category-packages.jpg", title: "Caixa Personalizada", specs: "18x18x10cm - Kraft - 4x0 cores", oldPrice: "", price: "R$ 129,90", reviews: "28", active: true },
  ],
  benefits: [
    { id: "print-quality", icon: "quality", label: "Qualidade", title: "Impressao de Qualidade", text: "Equipamentos modernos e materiais de alta performance para garantir acabamentos impecaveis e cores vibrantes.", active: true },
    { id: "color-precision", icon: "palette", label: "Precisao", title: "Cores Vivas e Precisao", text: "Tecnologia avancada de calibracao que garante fidelidade de cores e consistencia em todos os materiais.", active: true },
    { id: "deadline", icon: "delivery", label: "Confianca", title: "Prazos que Voce Pode Confiar", text: "Producao agil e logistica eficiente para entregar seu pedido no prazo combinado.", active: true },
    { id: "human-support", icon: "support", label: "Atendimento", title: "Atendimento Humanizado", text: "Nossa equipe esta pronta para atender sua necessidade e oferecer o melhor suporte do inicio ao fim do projeto.", active: true },
  ],
  testimonials: [
    { id: "juliana", name: "Juliana Andrade", role: "Empresaria", text: "A qualidade dos materiais e impecavel! Atendimento rapido e entrega antes do prazo.", initials: "JA", active: true },
    { id: "carlos", name: "Carlos Mendes", role: "Designer", text: "Ja sou cliente ha anos e nunca me decepcionei. Compromisso e qualidade definem a Grafica Exemplo.", initials: "CM", active: true },
    { id: "fernanda", name: "Fernanda Lima", role: "Marketing", text: "Os melhores precos e a qualidade que meu negocio precisa. Parceria que so cresce!", initials: "FL", active: true },
    { id: "ricardo", name: "Ricardo Souza", role: "Publicitario", text: "Facil de enviar a arte, acompanhar o pedido e o resultado e sempre perfeito!", initials: "RS", active: true },
  ],
  newsletter: {
    title: "Receba novidades e promocoes exclusivas!",
    subtitle: "Cadastre-se e ganhe 10% de desconto na sua primeira compra.",
    whatsapp: "5511999999999",
    message: "Ola! Quero receber novidades e promocoes exclusivas da Grafica Exemplo pelo WhatsApp.",
  },
  footer: {
    description: "Solucoes graficas completas para impulsionar seu negocio com qualidade, agilidade e preco justo.",
    columns: [
      { id: "institutional", title: "Institucional", items: ["Sobre nos", "Como funciona", "Trabalhe conosco", "Politica de qualidade", "Sustentabilidade"], active: true },
      { id: "help", title: "Ajuda", items: ["Duvidas frequentes", "Prazos e entregas", "Formas de pagamento", "Trocas e devolucoes", "Fale conosco"], active: true },
      { id: "categories", title: "Categorias", items: ["Todos os produtos", "Cartoes de Visita", "Folders", "Banners", "Adesivos", "Ver todas categorias"], active: true },
    ],
    copyright: "© 2026 Grafica Exemplo - Todos os direitos reservados.",
    developer: "Desenvolvido por Fluuid Automatize",
  },
  whatsappUrl: "https://wa.me/5511999999999",
};

export type QuoteStatus = "Rascunho" | "Enviado" | "Aceito" | "Expirado";

export type QuoteItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  attachmentUrl?: string;
  attachmentName?: string;
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
  order: number;
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
  fields?: string[];
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
  { id: "landing", label: "Landing Page" },
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
  canceled: {
    label: "Cancelados",
    color: "#647087",
    bg: "rgba(100, 112, 135, 0.14)",
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
  { id: "sec-comercial", name: "Comercial", orders: 8, capacity: 40, sla: "98%", lead: "1h", order: 0 },
  { id: "sec-arte", name: "Arte Final", orders: 12, capacity: 60, sla: "94%", lead: "4h", order: 1 },
  { id: "sec-impressao", name: "Impressão", orders: 18, capacity: 80, sla: "91%", lead: "8h", order: 2 },
  { id: "sec-laser", name: "Gravação Laser", orders: 7, capacity: 30, sla: "97%", lead: "6h", order: 3 },
  { id: "sec-acabamento", name: "Acabamento", orders: 10, capacity: 50, sla: "95%", lead: "5h", order: 4 },
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
