"use client";

import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  Mail,
  Package,
  Phone,
  ShieldCheck,
  Upload,
  User,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type PublicOrderItem = {
  id: string;
  description: string;
  quantity: number | string | null;
  unitPrice: number | string | null;
  discount?: number | string | null;
  total: number | string | null;
  status?: string | null;
  dueDate?: string | null;
  artFiles?: Array<{ id: string; name: string; url: string; size?: string }>;
};

type PublicOrderCustomer = {
  id?: string;
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  document?: string | null;
  documentType?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
};

type PublicOrderUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type PublicOrder = {
  id: string;
  number: string | null;
  status: string | null;
  productionStatus?: string | null;
  paymentStatus?: string | null;
  expectedDeliveryAt?: string | null;
  notes?: string | null;
  subtotal?: number | string | null;
  discountAmount?: number | string | null;
  taxAmount?: number | string | null;
  shippingAmount?: number | string | null;
  total?: number | string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  publicLinkExpiresAt?: string | null;
  publicLinkAcceptedAt?: string | null;
  customer?: PublicOrderCustomer | null;
  responsibleUser?: PublicOrderUser | null;
  tenant?: { name?: string | null } | null;
  order_items?: PublicOrderItem[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_GRAPHFLOW_API_URL?.replace(/\/$/, "") ?? "";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
}

function numeric(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Nao informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function dateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: string | null | undefined) {
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "IN_PRODUCTION") return "Em producao";
  if (status === "READY") return "Pronto";
  if (status === "SHIPPED") return "Enviado";
  if (status === "DELIVERED") return "Entregue";
  if (status === "CANCELED") return "Cancelado";
  return "Disponivel";
}

function stringMeta(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function formatDocument(customer?: PublicOrderCustomer | null) {
  const document = customer?.document?.replace(/\D/g, "") ?? "";
  if (!document) return "Nao informado";

  if (document.length === 14) {
    return document.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  if (document.length === 11) {
    return document.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  return customer?.document ?? document;
}

function customerAddress(customer?: PublicOrderCustomer | null) {
  const line = [customer?.addressStreet, customer?.addressNumber, customer?.addressComplement]
    .filter(Boolean)
    .join(", ");
  const cityLine = [customer?.addressDistrict, customer?.addressCity, customer?.addressState]
    .filter(Boolean)
    .join(" - ");
  return [line, cityLine, customer?.addressZip].filter(Boolean).join(" | ") || "Nao informado";
}

export default function PublicOrderPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = params.orderId;
  const token = searchParams.get("token") ?? "";
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const items = useMemo(() => order?.order_items ?? [], [order?.order_items]);
  const itemsWithoutFiles = useMemo(() => items.filter((item) => !item.artFiles || item.artFiles.length === 0), [items]);
  const hasItemsWithoutFiles = itemsWithoutFiles.length > 0;
  const subtotal = useMemo(
    () => order?.subtotal ?? items.reduce((sum, item) => sum + numeric(item.total), 0),
    [items, order?.subtotal],
  );
  const discount = order?.discountAmount ?? 0;
  const tax = order?.taxAmount ?? 0;
  const shipping = order?.shippingAmount ?? 0;
  const total = order?.total ?? Math.max(0, numeric(subtotal) - numeric(discount)) + numeric(tax) + numeric(shipping);
  const metadata = order?.metadata ?? {};
  const customer = order?.customer;
  const customerName = customer?.name || "Nao informado";
  const customerCompany = customer?.companyName || customer?.name || "Cliente";
  const customerEmail = customer?.email || "";
  const customerPhone = customer?.phone || customer?.whatsapp || "";
  const responsible = order?.responsibleUser?.name || "Equipe operacional";
  const issueDate = shortDate(order?.createdAt);
  const deliveryDate = shortDate(order?.expectedDeliveryAt);
  const acceptedAt = order?.publicLinkAcceptedAt || stringMeta(metadata, "acceptedAt");

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      if (!API_BASE_URL) {
        setError("API do GraficFlow nao configurada.");
        setLoading(false);
        return;
      }

      if (!orderId || !token) {
        setError("Link de pedido invalido.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message ?? "Nao foi possivel carregar este pedido.");
        }

        if (active) setOrder(payload as PublicOrder);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar este pedido.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOrder();
    return () => {
      active = false;
    };
  }, [orderId, token]);

  async function acceptOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAcceptError("");
    const form = new FormData(event.currentTarget);
    const acceptedByName = String(form.get("name") ?? "").trim();
    const acceptedByEmail = String(form.get("email") ?? "").trim();

    if (!acceptedByName || !acceptedByEmail.includes("@")) {
      setAcceptError("Informe nome e e-mail para confirmar o aceite.");
      return;
    }

    try {
      setAccepting(true);
      const response = await fetch(`${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, token, acceptedByName, acceptedByEmail }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "Nao foi possivel aceitar este pedido.");
      }

      const acceptedAt = typeof payload?.acceptedAt === "string" ? payload.acceptedAt : new Date().toISOString();
      setAccepted(true);
      setOrder((current) =>
        current
          ? {
              ...current,
              publicLinkAcceptedAt: acceptedAt,
              metadata: { ...(current.metadata ?? {}), acceptedAt },
            }
          : current,
      );
    } catch (acceptErrorResponse) {
      setAcceptError(
        acceptErrorResponse instanceof Error ? acceptErrorResponse.message : "Nao foi possivel aceitar este pedido.",
      );
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="public-quote-page">
      <section className="public-quote-shell">
        <header className="public-quote-header">
          <span>
            <ClipboardList size={24} />
          </span>
          <div>
            <p>{order?.tenant?.name ?? "GraficFlow"}</p>
            <h1>Pedido {order?.number ?? orderId}</h1>
          </div>
          {order ? <em>{statusLabel(order.status)}</em> : null}
        </header>

        {loading ? (
          <div className="public-quote-state">
            <Loader2 size={26} />
            <strong>Carregando pedido...</strong>
          </div>
        ) : error ? (
          <div className="public-quote-state error">
            <AlertCircle size={28} />
            <strong>{error}</strong>
          </div>
        ) : order ? (
          <>
            <section className="public-quote-deadline-grid" aria-label="Prazos e status do pedido">
              <article>
                <span>
                  <CalendarDays size={19} />
                </span>
                <div>
                  <small>Data do pedido</small>
                  <strong>{issueDate}</strong>
                </div>
              </article>
              <article>
                <span>
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <small>Status</small>
                  <strong>{statusLabel(order.status)}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Clock3 size={19} />
                </span>
                <div>
                  <small>Entrega prevista</small>
                  <strong>{deliveryDate}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Package size={19} />
                </span>
                <div>
                  <small>Producao</small>
                  <strong>{order.productionStatus || "WAITING"}</strong>
                </div>
              </article>
            </section>

            <div className="public-quote-complete-grid">
              <article className="public-quote-card">
                <h2>
                  <Building2 size={18} />
                  Dados do Cliente
                </h2>
                <dl className="public-quote-details two">
                  <div>
                    <dt>Cliente</dt>
                    <dd>{customerCompany}</dd>
                  </div>
                  <div>
                    <dt>Contato</dt>
                    <dd>{customerName}</dd>
                  </div>
                  <div>
                    <dt>E-mail</dt>
                    <dd>{customerEmail || "Nao informado"}</dd>
                  </div>
                  <div>
                    <dt>Telefone</dt>
                    <dd>{customerPhone || "Nao informado"}</dd>
                  </div>
                  <div>
                    <dt>Documento</dt>
                    <dd>{formatDocument(customer)}</dd>
                  </div>
                  <div>
                    <dt>Endereco</dt>
                    <dd>{customerAddress(customer)}</dd>
                  </div>
                </dl>
              </article>

              <article className="public-quote-card">
                <h2>
                  <FileText size={18} />
                  Informacoes do Pedido
                </h2>
                <dl className="public-quote-details three">
                  <div>
                    <dt>Numero</dt>
                    <dd>{order.number ?? order.id}</dd>
                  </div>
                  <div>
                    <dt>Data</dt>
                    <dd>{issueDate}</dd>
                  </div>
                  <div>
                    <dt>Entrega</dt>
                    <dd>{deliveryDate}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{statusLabel(order.status)}</dd>
                  </div>
                  <div>
                    <dt>Pagamento</dt>
                    <dd>{order.paymentStatus || "PENDING"}</dd>
                  </div>
                  <div>
                    <dt>Responsavel</dt>
                    <dd>{responsible}</dd>
                  </div>
                </dl>
              </article>
            </div>

            <div className="public-quote-body-grid">
              <div className="public-quote-main">
                <article className="public-quote-card">
                  <h2>Itens do Pedido</h2>
                  <div className="public-quote-table">
                    <div className="public-quote-table-head">
                      <span>Produto / Servico</span>
                      <span>Status</span>
                      <span>Qtd.</span>
                      <span>Un.</span>
                      <span>Valor Unit.</span>
                      <span>Valor Total</span>
                      <span>Arquivo</span>
                    </div>
                    {items.map((item) => (
                      <div className="public-quote-table-row" key={item.id}>
                        <strong>{item.description}</strong>
                        <span>{item.status || "PENDING"}</span>
                        <span>{numeric(item.quantity).toLocaleString("pt-BR")}</span>
                        <span>un</span>
                        <span>{money(item.unitPrice)}</span>
                        <strong>{money(item.total)}</strong>
                        <span>
                          {item.artFiles && item.artFiles.length > 0 ? (
                            <a
                              href={item.artFiles[0].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="icon-button"
                              title="Baixar arquivo"
                            >
                              <Download size={16} />
                            </a>
                          ) : null}
                        </span>
                      </div>
                    ))}
                    {items.length === 0 ? (
                      <div className="public-quote-table-row">
                        <strong>Nenhum item informado.</strong>
                        <span />
                        <span />
                        <span />
                        <span />
                        <strong>{money(0)}</strong>
                        <span />
                      </div>
                    ) : null}
                  </div>
                </article>

                <article className="public-quote-card">
                  <h2>Observacoes</h2>
                  <p className="public-quote-notes">
                    {order.notes || "Pedido sujeito aos prazos de producao e aprovacao operacional."}
                  </p>
                </article>
              </div>

              <aside className="public-quote-card public-quote-total-card">
                <h2>Resumo do Pedido</h2>
                <div className="public-quote-summary-lines">
                  <span>
                    Subtotal
                    <strong>{money(subtotal)}</strong>
                  </span>
                  <span>
                    Desconto
                    <strong>{money(discount)}</strong>
                  </span>
                  <span>
                    Impostos
                    <strong>{money(tax)}</strong>
                  </span>
                  <span>
                    Frete
                    <strong>{money(shipping)}</strong>
                  </span>
                </div>
                <div className="public-quote-total-line">
                  <span>Total</span>
                  <strong>{money(total)}</strong>
                </div>
                <div className="public-quote-validity">
                  <ShieldCheck size={18} />
                  Pedido gerado em {issueDate}
                </div>
                <div className="public-quote-validity public-quote-deadline-note">
                  <Clock3 size={18} />
                  Entrega prevista: {deliveryDate}
                </div>

                {hasItemsWithoutFiles && !showUpload ? (
                  <button
                    className="upload-art-button"
                    type="button"
                    onClick={() => setShowUpload(true)}
                  >
                    <Upload size={18} />
                    Enviar arquivo de arte
                  </button>
                ) : null}

                {showUpload && hasItemsWithoutFiles ? (
                  <div className="upload-art-section">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Enviar arquivo de arte</h3>
                      <button
                        type="button"
                        onClick={() => setShowUpload(false)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6b7280" }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <input
                      type="file"
                      id="art-file-upload"
                      accept=".pdf,.zip,.jpg,.jpeg,.png,.webp,.gif,.ai,.psd,.cdr"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const itemId = itemsWithoutFiles[0].id;
                        setUploadingFile(itemId);
                        
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          formData.append("orderId", orderId);
                          formData.append("itemId", itemId);
                          formData.append("token", token);
                          
                          const response = await fetch(`${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}/upload-art`, {
                            method: "POST",
                            body: formData,
                          });
                          
                          if (response.ok) {
                            // Reload order to show updated files
                            window.location.reload();
                          } else {
                            alert("Erro ao enviar arquivo. Tente novamente.");
                          }
                        } catch (err) {
                          alert("Erro ao enviar arquivo. Tente novamente.");
                        } finally {
                          setUploadingFile(null);
                        }
                      }}
                    />
                    <label
                      htmlFor="art-file-upload"
                      className="upload-art-dropzone"
                      style={{
                        border: "2px dashed #d1d5db",
                        borderRadius: "8px",
                        padding: "20px",
                        textAlign: "center",
                        cursor: "pointer",
                        display: "block",
                        background: "#f9fafb",
                      }}
                    >
                      {uploadingFile ? (
                        <Loader2 size={20} className="spin" style={{ margin: "0 auto" }} />
                      ) : (
                        <Upload size={20} style={{ opacity: 0.4, margin: "0 auto" }} />
                      )}
                      <p style={{ fontSize: "0.8rem", marginTop: "8px", opacity: 0.6 }}>
                        {uploadingFile ? "Enviando..." : "Clique para selecionar arquivo (PDF, ZIP, JPG, PNG, AI, PSD, CDR)"}
                      </p>
                    </label>
                  </div>
                ) : null}

                {accepted || acceptedAt ? (
                  <div className="public-quote-accepted">
                    <CheckCircle2 size={22} />
                    <div>
                      <strong>Pedido aceito.</strong>
                      <small>
                        {dateTime(acceptedAt) ? `Aceito em ${dateTime(acceptedAt)}.` : "Aceite confirmado."} Sem cancelamento por este link.
                      </small>
                    </div>
                  </div>
                ) : (
                  <form className="public-quote-accept" onSubmit={acceptOrder}>
                    <h3>Confirmar aceite</h3>
                    <label>
                      <User size={16} />
                      <input name="name" placeholder="Nome para aceite" required defaultValue={customerName} />
                    </label>
                    <label>
                      <Mail size={16} />
                      <input name="email" type="email" placeholder="E-mail" required defaultValue={customerEmail} />
                    </label>
                    {customerPhone ? (
                      <p>
                        <Phone size={15} />
                        {customerPhone}
                      </p>
                    ) : null}
                    {acceptError ? <span>{acceptError}</span> : null}
                    <button className="primary-button" type="submit" disabled={accepting}>
                      {accepting ? "Confirmando..." : "Aceitar pedido"}
                    </button>
                  </form>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
