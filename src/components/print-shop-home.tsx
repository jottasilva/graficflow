"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  CirclePlus,
  Heart,
  LockKeyhole,
  Mail,
  Menu,
  MessageCircle,
  Package,
  Phone,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Star,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { defaultLandingPageConfig } from "@/lib/graphflow-data";
import type { LandingPageConfig } from "@/lib/graphflow-data";
import { LANDING_ICON_MAP } from "@/lib/landing-icons";
import { CartSidebar } from "./cart-sidebar";
import type { CartItem } from "@/lib/cart-store";
import { loadCart, saveCart, getCartCount, getCartTotal, formatPrice } from "@/lib/cart-store";

const GRAPHFLOW_LOGO_SRC = "/assets/d2513524-f181-4a63-9fff-94a95de5aacf.png";

const GRAPHFLOW_TENANT_ID = "graphflow-main";

export function PrintShopHome() {
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState("R$ 0,00");

  useEffect(() => {
    const params = new URLSearchParams({ tenantId: GRAPHFLOW_TENANT_ID });
    fetch(`${process.env.NEXT_PUBLIC_GRAPHFLOW_API_URL ?? ""}/public/landing-page?${params.toString()}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setConfig(data?.config ?? defaultLandingPageConfig))
      .catch(() => setConfig(defaultLandingPageConfig));

    const syncCart = () => {
      const cart = loadCart();
      setCartCount(getCartCount(cart));
      setCartTotal(formatPrice(getCartTotal(cart)));
    };
    syncCart();
    window.addEventListener("cart-updated", syncCart);
    return () => window.removeEventListener("cart-updated", syncCart);
  }, []);

  function addToCart(product: LandingPageConfig["products"][number]) {
    const items = loadCart();
    const existing = items.find((i) => i.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({
        id: product.id,
        title: product.title,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity: 1,
        oldPrice: product.oldPrice,
        tag: product.tag,
      });
    }
    saveCart(items);
  }

  const c = config ?? defaultLandingPageConfig;

  return (
    <main className="store-page">
      <TopStrip config={c} />
      <StoreHeader config={c} cartCount={cartCount} cartTotal={cartTotal} onCartOpen={() => setCartOpen(true)} />
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />

      <section className="store-container">
        <StoreNav config={c} />

        <section className="store-hero">
          <div className="store-hero-slides" aria-hidden="true">
            {c.hero.slides.filter((s) => s.active).map((slide) => (
              <Image
                key={slide.id}
                src={slide.imageUrl}
                alt={slide.alt}
                fill
                sizes="(max-width: 900px) 100vw, 1200px"
                className="store-hero-image"
              />
            ))}
          </div>
          <div className="store-hero-copy">
            <h1>
              {c.hero.titlePrefix}
              <strong>
                {c.hero.titleHighlight.split("\\n").map((line, i) => (
                  <span key={i}>{line}<br /></span>
                ))}
              </strong>
            </h1>
            <p>{c.hero.description}</p>
            <div className="store-hero-actions">
              <Link className="store-primary" href={c.hero.primaryCta.href}>
                {c.hero.primaryCta.label}
                <ArrowRight size={18} />
              </Link>
              <Link className="store-secondary" href={c.hero.secondaryCta.href}>
                {c.hero.secondaryCta.label}
                <MessageCircle size={18} />
              </Link>
            </div>
          </div>
          <div className="store-hero-features">
            {c.hero.features.filter((f) => f.active).map((feature) => (
              <Feature key={feature.id} icon={feature.icon} title={feature.title} text={feature.text} />
            ))}
          </div>
          <div className="store-dots">
            {c.hero.slides.filter((s) => s.active).map((_, i) => (
              <span key={i} />
            ))}
          </div>
        </section>

        <section className="store-process">
          {c.process.filter((p) => p.active).map((step) => (
            <ProcessStep key={step.id} icon={step.icon} title={step.title} text={step.text} />
          ))}
        </section>

        <SectionTitle title="Categorias em destaque" action="Ver todas as categorias" />
        <section className="category-grid">
          {c.categories.filter((cat) => cat.active).map((cat) => (
            <article className="category-card" key={cat.id}>
              <Image src={cat.imageUrl} alt={cat.title} width={360} height={260} sizes="160px" />
              <div>
                <strong>{cat.title}</strong>
                <span>{cat.price}</span>
              </div>
            </article>
          ))}
        </section>

        <section id="produtos" className="product-section">
          <div className="product-head">
            <h2>Produtos mais vendidos</h2>
            <nav aria-label="Filtros de produtos">
              <a className="active" href="/produtos">Mais vendidos</a>
              <a href="/novidades">Novidades</a>
              <a href="/promocoes">Em promoção</a>
            </nav>
          </div>
          <div className="product-grid">
            {c.products.filter((p) => p.active).map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image">
                  <span>{product.tag}</span>
                  <button type="button" aria-label="Favoritar produto" title="Favoritar produto">
                    <Heart size={18} />
                  </button>
                  <Image src={product.imageUrl} alt={product.title} width={360} height={260} sizes="190px" />
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
                <button className="option-button" type="button" onClick={() => addToCart(product)}>
                  <Plus size={16} />
                  Adicionar ao carrinho
                </button>
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
            {c.benefits.filter((b) => b.active).map((benefit) => (
              <Benefit
                key={benefit.id}
                icon={benefit.icon}
                label={benefit.label}
                title={benefit.title}
                text={benefit.text}
              />
            ))}
          </div>
        </section>

        <SectionTitle title="O que nossos clientes dizem" action="Ver todas avaliações" rating />
        <section className="testimonial-grid">
          {c.testimonials.filter((t) => t.active).map((testimonial) => (
            <article className="testimonial-card" key={testimonial.id}>
              <div className="quote-mark">"</div>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={14} fill="currentColor" />
                ))}
              </div>
              <p>{testimonial.text}</p>
              <div className="testimonial-author">
                <span>{testimonial.initials}</span>
                <div>
                  <strong>{testimonial.name}</strong>
                  <small>{testimonial.role}</small>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="newsletter">
          <div>
            <MessageCircle size={26} />
            <div>
              <strong>{c.newsletter.title}</strong>
              <span>{c.newsletter.subtitle}</span>
            </div>
          </div>
          <form action="https://api.whatsapp.com/send" target="_blank">
            <input name="phone" type="hidden" value={c.newsletter.whatsapp} />
            <input name="text" type="hidden" value={c.newsletter.message} />
            <label className="sr-only" htmlFor="newsletter-whatsapp">Seu WhatsApp</label>
            <input id="newsletter-whatsapp" name="whatsapp" type="tel" placeholder="Seu WhatsApp" />
            <button type="submit">
              <MessageCircle size={17} />
              Cadastrar
            </button>
          </form>
        </section>
      </section>

      <StoreFooter config={c} />

      <Link className="whatsapp-float" href={c.whatsappUrl} aria-label="WhatsApp">
        <MessageCircle size={26} />
      </Link>
    </main>
  );
}

function TopStrip({ config }: { config: LandingPageConfig }) {
  return (
    <div className="top-strip">
      <div className="store-container">
        <span>{config.topStrip.welcome}</span>
        <span>
          <Phone size={14} />
          {config.topStrip.phone}
        </span>
        <span>
          <Mail size={14} />
          {config.topStrip.email}
        </span>
        <nav>
          {config.topStrip.links.map((link, i) => (
            <a key={i} href={link.href}>{link.label}</a>
          ))}
          <Camera className="social-icon" size={15} />
          <Send className="social-icon" size={15} />
        </nav>
      </div>
    </div>
  );
}

function StoreHeader({ config, cartCount, cartTotal, onCartOpen }: { config: LandingPageConfig; cartCount: number; cartTotal: string; onCartOpen: () => void }) {
  return (
    <header className="store-header">
      <div className="store-container">
        <Link className="store-brand" href="/">
          <Image
            src={config.brand.logoUrl || GRAPHFLOW_LOGO_SRC}
            alt={config.brand.name}
            width={280}
            height={70}
            className="store-brand-logo"
            style={{ width: 280, height: 70, objectFit: "contain" }}
            priority
          />
          <div>
            <strong>{config.brand.name}</strong>
            <small>{config.brand.tagline}</small>
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
          <Link href="/meus-pedidos">
            <Package size={28} />
            <span>
              <strong>Meus Pedidos</strong>
              Acompanhar
            </span>
          </Link>
          <button type="button" onClick={onCartOpen}>
            <span className="cart-icon">
              <ShoppingCart size={30} />
              {cartCount > 0 ? <i>{cartCount}</i> : null}
            </span>
            <span>
              <strong>Carrinho</strong>
              {cartTotal}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

function StoreNav({ config }: { config: LandingPageConfig }) {
  return (
    <nav className="store-nav" aria-label="Categorias principais">
      <button type="button">
        <Menu size={20} />
        Todas as Categorias
      </button>
      {config.navigation.map((link, i) => (
        <a key={i} href={link.href} className={i === 0 ? "active" : ""}>{link.label}</a>
      ))}
    </nav>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  const Icon = LANDING_ICON_MAP[icon];
  if (!Icon) return null;
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
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  const Icon = LANDING_ICON_MAP[icon];
  if (!Icon) return null;
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
      <a href="/produtos">
        {action}
        <CirclePlus size={17} />
      </a>
    </div>
  );
}

function Benefit({
  icon,
  label,
  title,
  text,
}: {
  icon: string;
  label: string;
  title: string;
  text: string;
}) {
  const Icon = LANDING_ICON_MAP[icon];
  if (!Icon) return null;
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

function StoreFooter({ config }: { config: LandingPageConfig }) {
  return (
    <footer className="store-footer">
      <div className="store-container footer-grid">
        <div>
          <Link className="store-brand footer-brand" href="/">
            <Image
              src={config.brand.logoUrl || GRAPHFLOW_LOGO_SRC}
              alt={config.brand.name}
              width={190}
              height={48}
              className="store-brand-logo"
              style={{ width: 190, height: 48, objectFit: "contain" }}
            />
            <div>
              <strong>{config.brand.name}</strong>
              <small>{config.brand.tagline}</small>
            </div>
          </Link>
          <p>{config.footer.description}</p>
          <div className="socials">
            <a href="#" aria-label="Instagram"><SocialLogo type="instagram" /></a>
            <a href="#" aria-label="Facebook"><SocialLogo type="facebook" /></a>
            <a href={config.whatsappUrl} aria-label="WhatsApp"><SocialLogo type="whatsapp" /></a>
          </div>
        </div>
        {config.footer.columns.filter((c) => c.active).map((col) => (
          <FooterColumn key={col.id} title={col.title} items={col.items} />
        ))}
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
        <span>{config.footer.copyright}</span>
        <nav>
          <a href="#">Política de Privacidade</a>
          <a href="#">Termos de Uso</a>
          <a href="#">Cookies</a>
        </nav>
        <span>{config.footer.developer}</span>
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
  const widths = { visa: 62, mastercard: 62, elo: 62, pix: 62, boleto: 78 };
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
          <li key={item}><a href="#">{item}</a></li>
        ))}
      </ul>
    </div>
  );
}
