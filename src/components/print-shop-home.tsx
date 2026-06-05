import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  ChevronDown,
  CirclePlus,
  Heart,
  LockKeyhole,
  Mail,
  Menu,
  MessageCircle,
  PackageCheck,
  Palette,
  Phone,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Upload,
  User,
  Users,
  WalletCards,
} from "lucide-react";

const GRAPHFLOW_LOGO_SRC = "/assets/d2513524-f181-4a63-9fff-94a95de5aacf.png";

const categories = [
  ["Cartões de Visita", "A partir de R$ 29,90", "/assets/category-business-cards.jpg"],
  ["Folders", "A partir de R$ 99,90", "/assets/category-folders.jpg"],
  ["Banners", "A partir de R$ 59,90", "/assets/category-banners.jpg"],
  ["Adesivos", "A partir de R$ 49,90", "/assets/category-stickers.jpg"],
  ["Convites", "A partir de R$ 89,90", "/assets/category-invites.jpg"],
  ["Brindes", "A partir de R$ 19,90", "/assets/category-mugs.jpg"],
  ["Embalagens", "A partir de R$ 129,90", "/assets/category-packages.jpg"],
  ["Placas", "A partir de R$ 69,90", "/assets/category-plates.jpg"],
] as const;

const products = [
  {
    tag: "MAIS VENDIDO",
    image: "/assets/category-business-cards.jpg",
    title: "Cartão de Visita Couchê 300g",
    specs: "4x0 cores · Verniz Total Frente",
    oldPrice: "",
    price: "R$ 29,90",
    reviews: "124",
  },
  {
    tag: "15% OFF",
    image: "/assets/category-folders.jpg",
    title: "Folder Couchê 150g",
    specs: "15x21cm · 4x4 cores · Verniz Total",
    oldPrice: "R$ 129,90",
    price: "R$ 109,90",
    reviews: "86",
  },
  {
    tag: "NOVO",
    image: "/assets/category-stickers.jpg",
    title: "Adesivo Redondo",
    specs: "5x5cm · Vinil · 4x0 cores",
    oldPrice: "",
    price: "R$ 49,90",
    reviews: "53",
  },
  {
    tag: "MAIS VENDIDO",
    image: "/assets/category-banners.jpg",
    title: "Banner Lona 440g",
    specs: "80x120cm · 4x0 cores",
    oldPrice: "",
    price: "R$ 59,90",
    reviews: "71",
  },
  {
    tag: "10% OFF",
    image: "/assets/category-mugs.jpg",
    title: "Caneca Personalizada",
    specs: "Cerâmica · 325ml · 4x0 cores",
    oldPrice: "R$ 39,90",
    price: "R$ 35,90",
    reviews: "37",
  },
  {
    tag: "NOVO",
    image: "/assets/category-packages.jpg",
    title: "Caixa Personalizada",
    specs: "18x18x10cm · Kraft · 4x0 cores",
    oldPrice: "",
    price: "R$ 129,90",
    reviews: "28",
  },
] as const;

const testimonials = [
  ["Juliana Andrade", "Empresária", "A qualidade dos materiais é impecável! Atendimento rápido e entrega antes do prazo.", "JA"],
  ["Carlos Mendes", "Designer", "Já sou cliente há anos e nunca me decepcionei. Compromisso e qualidade definem a Gráfica Exemplo.", "CM"],
  ["Fernanda Lima", "Marketing", "Os melhores preços e a qualidade que meu negócio precisa. Parceria que só cresce!", "FL"],
  ["Ricardo Souza", "Publicitário", "Fácil de enviar a arte, acompanhar o pedido e o resultado é sempre perfeito!", "RS"],
] as const;

const heroSlides = [
  "/assets/hero-design-studio.jpg",
  "/assets/hero-print-machine.jpg",
] as const;

export function PrintShopHome() {
  return (
    <main className="store-page">
      <TopStrip />
      <StoreHeader />

      <section className="store-container">
        <StoreNav />

        <section className="store-hero">
          <div className="store-hero-slides" aria-hidden="true">
            {heroSlides.map((src, index) => (
              <Image
                key={src}
                src={src}
                alt=""
                fill
                priority={index === 0}
                sizes="(max-width: 900px) 100vw, 1200px"
                className="store-hero-image"
              />
            ))}
          </div>
          <div className="store-hero-copy">
            <h1>
              Soluções gráficas
              <strong>
                para impulsionar
                <br />
                seu negócio
              </strong>
            </h1>
            <p>Da criação à impressão, entregamos qualidade, agilidade e acabamento impecável.</p>
            <div className="store-hero-actions">
              <Link className="store-primary" href="#produtos">
                Conheça nossos produtos
                <ArrowRight size={18} />
              </Link>
              <Link className="store-secondary" href="https://wa.me/5511999999999">
                Fazer orçamento
                <MessageCircle size={18} />
              </Link>
            </div>
          </div>
          <div className="store-hero-features">
            <Feature icon={ShieldCheck} title="Qualidade Garantida" text="Materiais de primeira linha" />
            <Feature icon={Truck} title="Entrega Rápida" text="Para todo o Brasil" />
            <Feature icon={Users} title="Atendimento Especializado" text="Suporte via WhatsApp" />
            <Feature icon={WalletCards} title="Pagamento Seguro" text="Seus dados protegidos" />
          </div>
          <div className="store-dots">
            <span />
            <span />
            <span />
          </div>
        </section>

        <section className="store-process">
          <ProcessStep icon={Upload} title="Envie sua arte" text="Faça upload do seu arquivo nos formatos: PDF, CDR, AI, PSD, PNG" />
          <ProcessStep icon={Settings2} title="Personalize" text="Escolha as opções do produto e personalize do seu jeito" />
          <ProcessStep icon={PackageCheck} title="Receba em casa" text="Entregamos para todo o Brasil com segurança e agilidade" />
        </section>

        <SectionTitle title="Categorias em destaque" action="Ver todas as categorias" />
        <section className="category-grid">
          {categories.map(([title, price, image]) => (
            <article className="category-card" key={title}>
              <Image src={image} alt={title} width={360} height={260} sizes="160px" />
              <div>
                <strong>{title}</strong>
                <span>{price}</span>
              </div>
            </article>
          ))}
        </section>

        <section id="produtos" className="product-section">
          <div className="product-head">
            <h2>Produtos mais vendidos</h2>
            <nav aria-label="Filtros de produtos">
              <a className="active" href="#produtos">Mais vendidos</a>
              <a href="#produtos">Novidades</a>
              <a href="#produtos">Em promoção</a>
            </nav>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.title}>
                <div className="product-image">
                  <span>{product.tag}</span>
                  <button type="button" aria-label="Favoritar produto" title="Favoritar produto">
                    <Heart size={18} />
                  </button>
                  <Image src={product.image} alt={product.title} width={360} height={260} sizes="190px" />
                </div>
                <h3>{product.title}</h3>
                <p>{product.specs}</p>
                <div className="rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={14} fill="currentColor" />
                  ))}
                  <span>({product.reviews})</span>
                </div>
                <small>A partir de</small>
                {product.oldPrice ? <del>{product.oldPrice}</del> : null}
                <strong>{product.price}</strong>
                <button className="option-button" type="button">Ver opções</button>
              </article>
            ))}
          </div>
        </section>

        <section className="why-band">
          <h2>
            Compromisso com a <span>qualidade</span> em cada detalhe
          </h2>
          <p>Tecnologia, experiência e dedicação para entregar soluções gráficas que impulsionam o seu projeto e fortalecem a sua marca.</p>
          <div>
            <Benefit
              icon={BadgeCheck}
              label="Qualidade"
              title="Impressão de Qualidade"
              text="Equipamentos modernos e materiais de alta performance para garantir acabamentos impecáveis e cores vibrantes."
            />
            <Benefit
              icon={Palette}
              label="Precisão"
              title="Cores Vivas e Precisão"
              text="Tecnologia avançada de calibração que garante fidelidade de cores e consistência em todos os materiais."
            />
            <Benefit
              icon={ShieldCheck}
              label="Confiança"
              title="Prazos que Você Pode Confiar"
              text="Produção ágil e logística eficiente para entregar seu pedido no prazo combinado, com rastreamento em todas as etapas."
            />
            <Benefit
              icon={Users}
              label="Atendimento"
              title="Atendimento Humanizado"
              text="Nossa equipe está pronta para atender sua necessidade e oferecer o melhor suporte do início ao fim do projeto."
            />
          </div>
        </section>

        <SectionTitle title="O que nossos clientes dizem" action="Ver todas avaliações" rating />
        <section className="testimonial-grid">
          {testimonials.map(([name, role, text, initials]) => (
            <article className="testimonial-card" key={name}>
              <div className="quote-mark">“</div>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={14} fill="currentColor" />
                ))}
              </div>
              <p>{text}</p>
              <div className="testimonial-author">
                <span>{initials}</span>
                <div>
                  <strong>{name}</strong>
                  <small>{role}</small>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="newsletter">
          <div>
            <MessageCircle size={26} />
            <div>
              <strong>Receba novidades e promoções exclusivas!</strong>
              <span>Cadastre-se e ganhe 10% de desconto na sua primeira compra.</span>
            </div>
          </div>
          <form action="https://api.whatsapp.com/send" target="_blank">
            <input name="phone" type="hidden" value="5511999999999" />
            <input
              name="text"
              type="hidden"
              value="Olá! Quero receber novidades e promoções exclusivas da Gráfica Exemplo pelo WhatsApp."
            />
            <label className="sr-only" htmlFor="newsletter-whatsapp">Seu WhatsApp</label>
            <input id="newsletter-whatsapp" name="whatsapp" type="tel" placeholder="Seu WhatsApp" />
            <button type="submit">
              <MessageCircle size={17} />
              Cadastrar
            </button>
          </form>
        </section>
      </section>

      <StoreFooter />

      <Link className="whatsapp-float" href="https://wa.me/5511999999999" aria-label="WhatsApp">
        <MessageCircle size={26} />
      </Link>
    </main>
  );
}

function TopStrip() {
  return (
    <div className="top-strip">
      <div className="store-container">
        <span>Bem-vindo à Gráfica Exemplo!</span>
        <span>
          <Phone size={14} />
          Atendimento: (11) 99999-9999
        </span>
        <span>
          <Mail size={14} />
          contato@graficaexemplo.com.br
        </span>
        <nav>
          <a href="#sobre">Sobre nós</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#pedidos">Meus pedidos</a>
          <a href="#contato">Fale conosco</a>
          <Camera className="social-icon" size={15} />
          <Send className="social-icon" size={15} />
        </nav>
      </div>
    </div>
  );
}

function StoreHeader() {
  return (
    <header className="store-header">
      <div className="store-container">
        <Link className="store-brand" href="/">
          <Image
            src={GRAPHFLOW_LOGO_SRC}
            alt="GraficFlow"
            width={190}
            height={48}
            className="store-brand-logo"
            style={{ width: 190, height: 48, objectFit: "contain" }}
            priority
          />
          <div>
            <strong>Gráfica Exemplo</strong>
            <small>Impressão de qualidade</small>
          </div>
        </Link>

        <form className="store-search">
          <input type="search" placeholder="Buscar por produtos, categorias..." />
          <button className="search-select" type="button">
            Todos
            <ChevronDown size={16} />
          </button>
          <button className="search-submit" type="submit" aria-label="Buscar" title="Buscar">
            <Search size={20} />
          </button>
        </form>

        <div className="store-account">
          <Link href="/painel">
            <User size={28} />
            <span>
              <strong>Entrar</strong>
              Minha conta
            </span>
          </Link>
          <button type="button">
            <span className="cart-icon">
              <ShoppingCart size={30} />
              <i>3</i>
            </span>
            <span>
              <strong>Carrinho</strong>
              R$ 235,00
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

function StoreNav() {
  return (
    <nav className="store-nav" aria-label="Categorias principais">
      <button type="button">
        <Menu size={20} />
        Todas as Categorias
      </button>
      <a className="active" href="#">Início</a>
      <a href="#produtos">Todos os Produtos</a>
      <a href="#produtos">Personalizados</a>
      <a href="#produtos">Promoções</a>
      <a href="#produtos">Novidades</a>
      <a href="#produtos">Catálogo Online</a>
      <a href="#produtos">Upload de Arte</a>
    </nav>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="store-feature">
      <Icon size={20} />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function ProcessStep({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Upload;
  title: string;
  text: string;
}) {
  return (
    <article>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <Icon size={34} />
    </article>
  );
}

function SectionTitle({
  title,
  action,
  rating = false,
}: {
  title: string;
  action: string;
  rating?: boolean;
}) {
  return (
    <div className="store-section-title">
      <div>
        <h2>{title}</h2>
        {rating ? (
          <p>
            <strong>4.9</strong>
            <span>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={14} fill="currentColor" />
              ))}
            </span>
            Baseado em 2.350 avaliações
          </p>
        ) : null}
      </div>
      <a href="#produtos">
        {action}
        <CirclePlus size={17} />
      </a>
    </div>
  );
}

function Benefit({
  icon: Icon,
  label,
  title,
  text,
}: {
  icon: typeof BadgeCheck;
  label: string;
  title: string;
  text: string;
}) {
  return (
    <article>
      <em>{label}</em>
      <span>
        <Icon size={24} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <button type="button" aria-label={`Ver detalhe: ${title}`}>
        <ArrowRight size={18} />
      </button>
    </article>
  );
}

function StoreFooter() {
  return (
    <footer className="store-footer">
      <div className="store-container footer-grid">
        <div>
          <Link className="store-brand footer-brand" href="/">
            <Image
              src={GRAPHFLOW_LOGO_SRC}
              alt="GraficFlow"
              width={190}
              height={48}
              className="store-brand-logo"
              style={{ width: 190, height: 48, objectFit: "contain" }}
            />
            <div>
              <strong>Gráfica Exemplo</strong>
              <small>Impressão de qualidade</small>
            </div>
          </Link>
          <p>Soluções gráficas completas para impulsionar seu negócio com qualidade, agilidade e preço justo.</p>
          <div className="socials">
            <a href="#" aria-label="Instagram">
              <SocialLogo type="instagram" />
            </a>
            <a href="#" aria-label="Facebook">
              <SocialLogo type="facebook" />
            </a>
            <a href="https://wa.me/5511999999999" aria-label="WhatsApp">
              <SocialLogo type="whatsapp" />
            </a>
          </div>
        </div>
        <FooterColumn title="Institucional" items={["Sobre nós", "Como funciona", "Trabalhe conosco", "Política de qualidade", "Sustentabilidade"]} />
        <FooterColumn title="Ajuda" items={["Dúvidas frequentes", "Prazos e entregas", "Formas de pagamento", "Trocas e devoluções", "Fale conosco"]} />
        <FooterColumn title="Categorias" items={["Todos os produtos", "Cartões de Visita", "Folders", "Banners", "Adesivos", "Ver todas categorias"]} />
        <div>
          <h3>Formas de Pagamento</h3>
          <div className="payment-tags">
            <PaymentLogo type="visa" label="Visa" />
            <PaymentLogo type="mastercard" label="Mastercard" />
            <PaymentLogo type="elo" label="Elo" />
            <PaymentLogo type="pix" label="Pix" />
            <PaymentLogo type="boleto" label="Boleto" />
          </div>
        </div>
        <div>
          <h3>Segurança</h3>
          <p className="secure-line">
            <LockKeyhole size={24} />
            Site 100% seguro
            <br />
            Seus dados protegidos
          </p>
        </div>
      </div>
      <div className="store-container footer-bottom">
        <span>© 2025 Gráfica Exemplo · Todos os direitos reservados.</span>
        <nav>
          <a href="#">Política de Privacidade</a>
          <a href="#">Termos de Uso</a>
          <a href="#">Cookies</a>
        </nav>
        <span>Desenvolvido por Fluuid Automatize</span>
      </div>
    </footer>
  );
}

function SocialLogo({ type }: { type: "instagram" | "facebook" | "whatsapp" }) {
  if (type === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (type === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.2 8.4V6.9c0-.7.5-.9 1-.9h2V2.6L14.4 2.5c-3.1 0-4.8 1.9-4.8 5.1v.8H6.5v3.8h3.1V22h4.1v-9.8h3.2l.5-3.8h-3.2Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.1 3.2a8.7 8.7 0 0 0-7.4 13.2L3.8 21l4.7-1.2a8.7 8.7 0 1 0 3.6-16.6Zm0 15.7a7 7 0 0 1-3.5-.9l-.3-.2-2.8.7.7-2.7-.2-.3a7 7 0 1 1 6.1 3.4Zm3.9-5.2c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.5.1l-.7.8c-.1.2-.3.2-.5.1a5.8 5.8 0 0 1-2.9-2.5c-.2-.3 0-.4.1-.5l.4-.5c.1-.1.1-.3.2-.4s0-.3 0-.4c-.1-.1-.5-1.2-.7-1.7-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 3.9 3.4 2.3.9 2.3.6 2.7.6.4 0 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1 0-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

function PaymentLogo({ type, label }: { type: "visa" | "mastercard" | "elo" | "pix" | "boleto"; label: string }) {
  const widths = {
    visa: 62,
    mastercard: 62,
    elo: 62,
    pix: 62,
    boleto: 78,
  };

  return (
    <span className={`payment-logo payment-logo-${type}`} role="img" aria-label={label}>
      <Image src={`/assets/payments/${type}.svg`} alt={label} width={widths[type]} height={28} unoptimized />
    </span>
  );
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <a href="#">{item}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
