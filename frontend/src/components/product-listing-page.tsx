"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Star,
  User,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { defaultLandingPageConfig } from "@/lib/graphflow-data";
import type { LandingPageConfig, LandingProductCard } from "@/lib/graphflow-data";
import { CartSidebar } from "./cart-sidebar";
import { loadCart, saveCart, getCartCount, getCartTotal, formatPrice } from "@/lib/cart-store";

const GRAPHFLOW_LOGO_SRC = "/assets/d2513524-f181-4a63-9fff-94a95de5aacf.png";
const GRAPHFLOW_TENANT_ID = "graphflow-main";

type FilterKey = "all" | "personalizados" | "promocoes" | "novidades";

const filterLabels: Record<FilterKey, string> = {
  all: "Todos",
  personalizados: "Personalizados",
  promocoes: "Promoções",
  novidades: "Novidades",
};

export function ProductListingPage({
  defaultFilter = "all",
  title = "Todos os Produtos",
}: {
  defaultFilter?: FilterKey;
  title?: string;
}) {
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>(defaultFilter);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState("R$ 0,00");

  useEffect(() => {
    const params = new URLSearchParams({ tenantId: GRAPHFLOW_TENANT_ID });
    fetch(`${process.env.NEXT_PUBLIC_GRAPHFLOW_API_URL ?? ""}/public/landing-page?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
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

  function addToCart(product: LandingProductCard) {
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

  const filteredProducts = c.products.filter((p) => {
    if (activeFilter === "all") return p.active;
    if (activeFilter === "promocoes") return p.active && p.oldPrice;
    if (activeFilter === "novidades") return p.active && p.tag === "NOVO";
    return p.active;
  });

  return (
    <main className="store-page">
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />
      <header className="store-header">
        <div className="store-container">
          <Link className="store-brand" href="/">
            <Image
              src={c.brand.logoUrl || GRAPHFLOW_LOGO_SRC}
              alt={c.brand.name}
              width={190}
              height={48}
              className="store-brand-logo"
              style={{ width: 190, height: 48, objectFit: "contain" }}
              priority
            />
            <div>
              <strong>{c.brand.name}</strong>
              <small>{c.brand.tagline}</small>
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
            <button type="button" onClick={() => setCartOpen(true)}>
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

      <section className="store-container">
        <div style={{ padding: "32px 0 8px" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>{title}</h1>
        </div>

        <nav
          style={{
            display: "flex",
            gap: "8px",
            padding: "16px 0",
            borderBottom: "1px solid var(--border, #e5e7eb)",
            marginBottom: "24px",
          }}
          aria-label="Filtros de produtos"
        >
          {(Object.keys(filterLabels) as FilterKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`permission-chip ${activeFilter === key ? "active" : ""}`}
              onClick={() => setActiveFilter(key)}
            >
              {filterLabels[key]}
            </button>
          ))}
        </nav>

        <div className="product-grid" style={{ marginBottom: "48px" }}>
          {filteredProducts.length === 0 ? (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 0", opacity: 0.6 }}>
              Nenhum produto encontrado nesta categoria.
            </p>
          ) : (
            filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))
          )}
        </div>
      </section>

      <footer className="store-footer">
        <div className="store-container footer-grid">
          <div>
            <Link className="store-brand footer-brand" href="/">
              <Image
                src={c.brand.logoUrl || GRAPHFLOW_LOGO_SRC}
                alt={c.brand.name}
                width={190}
                height={48}
                className="store-brand-logo"
                style={{ width: 190, height: 48, objectFit: "contain" }}
              />
              <div>
                <strong>{c.brand.name}</strong>
                <small>{c.brand.tagline}</small>
              </div>
            </Link>
            <p>{c.footer.description}</p>
          </div>
        </div>
        <div className="store-container footer-bottom">
          <span>{c.footer.copyright}</span>
          <nav>
            <a href="#">Política de Privacidade</a>
            <a href="#">Termos de Uso</a>
            <a href="#">Cookies</a>
          </nav>
          <span>{c.footer.developer}</span>
        </div>
      </footer>

      <Link className="whatsapp-float" href={c.whatsappUrl} aria-label="WhatsApp">
        <MessageCircle size={26} />
      </Link>
    </main>
  );
}

function ProductCard({ product, onAddToCart }: { product: LandingProductCard; onAddToCart: (p: LandingProductCard) => void }) {
  return (
    <article className="product-card">
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
      <button className="option-button" type="button" onClick={() => onAddToCart(product)}>
        <Plus size={16} />
        Adicionar ao carrinho
      </button>
    </article>
  );
}
