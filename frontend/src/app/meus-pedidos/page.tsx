"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Eye,
  Loader2,
  Mail,
  Lock,
  LogIn,
  MessageCircle,
  Package,
  Phone,
  Search,
  ShoppingCart,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { graphflowApi } from "@/lib/graphflow-api";
import type { AuthSession } from "@/lib/graphflow-api";
import type { Order, LandingPageConfig } from "@/lib/graphflow-data";
import { defaultLandingPageConfig } from "@/lib/graphflow-data";
import { CartSidebar } from "@/components/cart-sidebar";
import { loadCart, saveCart, getCartCount, getCartTotal, formatPrice } from "@/lib/cart-store";

const GRAPHFLOW_LOGO_SRC = "/assets/d2513524-f181-4a63-9fff-94a95de5aacf.png";
const GRAPHFLOW_TENANT_ID = "graphflow-main";

const statusLabel: Record<string, string> = {
  approval: "Aprovacao",
  payment: "Pagamento",
  production: "Producao",
  conference: "Conferencia",
  shipping: "Expedicao",
  delivered: "Entregue",
  canceled: "Cancelado",
};

const statusColor: Record<string, string> = {
  approval: "#f59e0b",
  payment: "#3b82f6",
  production: "#8b5cf6",
  conference: "#06b6d4",
  shipping: "#f97316",
  delivered: "#22c55e",
  canceled: "#ef4444",
};

export default function MeusPedidosPage() {
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ tenantId: GRAPHFLOW_TENANT_ID });
    fetch(`${process.env.NEXT_PUBLIC_GRAPHFLOW_API_URL ?? ""}/public/landing-page?${params.toString()}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setConfig(data?.config ?? defaultLandingPageConfig))
      .catch(() => setConfig(defaultLandingPageConfig));

    graphflowApi.session()
      .then((s) => {
        setSession(s);
        if (s.authenticated) {
          fetchOrders();
        }
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    setCartCount(getCartCount(loadCart()));
    const handler = () => setCartCount(getCartCount(loadCart()));
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, []);

  async function fetchOrders() {
    setOrdersLoading(true);
    try {
      const list = await graphflowApi.listOrders([], [], []);
      setOrders(list as Order[]);
    } catch {} finally {
      setOrdersLoading(false);
    }
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const s = await graphflowApi.login({ email: loginEmail, password: loginPassword, remember: false });
      setSession(s);
      fetchOrders();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Email ou senha invalidos.");
    } finally {
      setLoginLoading(false);
    }
  }

  const c = config ?? defaultLandingPageConfig;
  const cartTotal = formatPrice(getCartTotal(loadCart()));

  return (
    <main className="store-page">
      <header className="store-header">
        <div className="store-container">
          <Link className="store-brand" href="/">
            <Image src={c.brand.logoUrl || GRAPHFLOW_LOGO_SRC} alt={c.brand.name} width={190} height={48} className="store-brand-logo" style={{ width: 190, height: 48, objectFit: "contain" }} priority />
            <div><strong>{c.brand.name}</strong><small>{c.brand.tagline}</small></div>
          </Link>
          <form className="store-search">
            <input type="search" placeholder="Buscar por produtos, categorias..." />
            <button className="search-select" type="button">Todos<ChevronDown size={16} /></button>
            <button className="search-submit" type="submit" aria-label="Buscar"><Search size={20} /></button>
          </form>
          <div className="store-account">
            {session?.authenticated ? (
              <Link href="/painel">
                <User size={28} />
                <span><strong>Painel</strong>Minha conta</span>
              </Link>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Link href="/login" style={{ display: "flex", alignItems: "center", gap: 8, color: "#111827", textDecoration: "none" }}>
                  <User size={28} />
                  <span><strong>Entrar</strong>Minha conta</span>
                </Link>
              </span>
            )}
            <button type="button" onClick={() => setCartOpen(true)}>
              <span className="cart-icon">
                <ShoppingCart size={30} />
                {cartCount > 0 ? <i>{cartCount}</i> : null}
              </span>
              <span><strong>Carrinho</strong>{cartTotal}</span>
            </button>
          </div>
        </div>
      </header>

      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />

      <section className="store-container" style={{ minHeight: "60vh", paddingTop: 32, paddingBottom: 48 }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 24 }}>Meus Pedidos</h1>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <Loader2 size={32} className="spin" />
          </div>
        ) : session?.authenticated ? (
          ordersLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
              <Loader2 size={32} className="spin" />
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", opacity: 0.6 }}>
              <Package size={48} style={{ margin: "0 auto 12px" }} />
              <p>Nenhum pedido encontrado.</p>
              <Link href="/produtos" className="cart-browse">Ver produtos</Link>
            </div>
          ) : (
            <div className="orders-table">
              <div className="orders-table-head">
                <span>Pedido</span>
                <span>Cliente</span>
                <span>Produto</span>
                <span>Status</span>
                <span>Entrega</span>
                <span></span>
              </div>
              {orders.map((order) => (
                <div className="orders-table-row" key={order.id}>
                  <span><strong>{order.number ?? order.id}</strong></span>
                  <span>{order.customer}</span>
                  <span>{order.product}</span>
                  <span>
                    <span className="order-status-badge" style={{ background: `${statusColor[order.status] ?? "#6b7280"}18`, color: statusColor[order.status] ?? "#6b7280" }}>
                      {statusLabel[order.status] ?? order.status}
                    </span>
                  </span>
                  <span>{order.delivery}</span>
                  <span>
                    <Link href={`/painel?order=${order.id}`} className="icon-button" style={{ display: "inline-flex" }} title="Ver detalhes">
                      <Eye size={16} />
                    </Link>
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="login-card">
            <h2>Faça login para ver seus pedidos</h2>
            <p>Entre com sua conta para acompanhar o status dos seus pedidos.</p>
            <form onSubmit={handleLogin}>
              <label>
                Email
                <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="seu@email.com" />
              </label>
              <label>
                Senha
                <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Sua senha" />
              </label>
              {loginError ? <p className="login-error">{loginError}</p> : null}
              <button className="primary-button" type="submit" disabled={loginLoading}>
                {loginLoading ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}
                Entrar
              </button>
            </form>
            <p className="login-footer">
              <Link href="/cadastro">Criar conta</Link>
              <Link href="/login">Esqueci a senha</Link>
            </p>
          </div>
        )}
      </section>

      <footer className="store-footer">
        <div className="store-container footer-grid">
          <div>
            <Link className="store-brand footer-brand" href="/">
              <Image src={c.brand.logoUrl || GRAPHFLOW_LOGO_SRC} alt={c.brand.name} width={190} height={48} className="store-brand-logo" style={{ width: 190, height: 48, objectFit: "contain" }} />
              <div><strong>{c.brand.name}</strong><small>{c.brand.tagline}</small></div>
            </Link>
            <p>{c.footer.description}</p>
          </div>
        </div>
        <div className="store-container footer-bottom">
          <span>{c.footer.copyright}</span>
          <nav>
            <a href="#">Politica de Privacidade</a>
            <a href="#">Termos de Uso</a>
            <a href="#">Cookies</a>
          </nav>
          <span>{c.footer.developer}</span>
        </div>
      </footer>

      <Link className="whatsapp-float" href={c.whatsappUrl} aria-label="WhatsApp"><MessageCircle size={26} /></Link>

      <style>{`
        .orders-table {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .orders-table-head, .orders-table-row {
          display: grid;
          grid-template-columns: 140px 1fr 1.5fr 120px 110px 50px;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          font-size: 13px;
        }
        .orders-table-head {
          background: #f9fafb;
          color: #6b7280;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 11px;
        }
        .orders-table-row + .orders-table-row {
          border-top: 1px solid #f3f4f6;
        }
        .orders-table-row:hover {
          background: #f9fafb;
        }
        .order-status-badge {
          display: inline-flex;
          min-height: 26px;
          align-items: center;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 520;
        }
        .login-card {
          max-width: 400px;
          margin: 0 auto;
          padding: 32px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
        }
        .login-card h2 {
          margin: 0 0 6px;
          font-size: 18px;
        }
        .login-card > p {
          margin: 0 0 20px;
          color: #6b7280;
          font-size: 13px;
        }
        .login-card form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .login-card label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          font-weight: 500;
        }
        .login-card input {
          height: 42px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 14px;
          font-size: 14px;
        }
        .login-card .primary-button {
          width: 100%;
          justify-content: center;
        }
        .login-error {
          color: #ef4444 !important;
          font-size: 12px !important;
        }
        .login-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 16px !important;
        }
        .login-footer a {
          color: #5b45ff;
          font-size: 13px;
          text-decoration: none;
        }
        .cart-browse {
          display: inline-flex;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          padding: 0 20px;
          border-radius: 8px;
          background: linear-gradient(135deg, #5b45ff, #6d37ff);
          color: #fff;
          font-size: 13px;
          font-weight: 520;
          text-decoration: none;
          margin-top: 12px;
        }
        .icon-button {
          width: 36px;
          height: 36px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          color: #6b7280;
        }
        .icon-button:hover {
          background: #f3f4f6;
        }
        @media (max-width: 700px) {
          .orders-table-head, .orders-table-row {
            grid-template-columns: 1fr 1fr;
          }
          .orders-table-head span:nth-child(3),
          .orders-table-head span:nth-child(5),
          .orders-table-head span:nth-child(6),
          .orders-table-row span:nth-child(3),
          .orders-table-row span:nth-child(5),
          .orders-table-row span:nth-child(6) {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}
