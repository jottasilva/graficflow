"use client";

import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type PublicQuoteItem = {
  id: string;
  description: string;
  notes?: string | null;
  quantity: number | string | null;
  unitPrice: number | string | null;
  discount?: number | string | null;
  total: number | string | null;
};

type PublicQuoteCustomer = {
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

type PublicQuoteUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type PublicQuote = {
  id: string;
  number: string | null;
  status: string | null;
  validUntil: string | null;
  notes?: string | null;
  subtotal?: number | string | null;
  discountAmount?: number | string | null;
  taxAmount?: number | string | null;
  total?: number | string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  publicLinkExpiresAt?: string | null;
  publicLinkAcceptedAt?: string | null;
  customer?: PublicQuoteCustomer | null;
  responsibleUser?: PublicQuoteUser | null;
  tenant?: { name?: string | null } | null;
  quote_items?: PublicQuoteItem[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_GRAPHFLOW_API_URL?.replace(/\/$/, "") ?? "";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
}

function numeric(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
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
  if (status === "ACCEPTED") return "Aceito";
  if (status === "VIEWED") return "Visualizado";
  if (status === "SENT") return "Enviado";
  if (status === "DRAFT") return "Rascunho";
  if (status === "EXPIRED") return "Expirado";
  return "Disponível";
}

function stringMeta(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function formatDocument(customer?: PublicQuoteCustomer | null) {
  const document = customer?.document?.replace(/\D/g, "") ?? "";
  if (!document) return "Não informado";

  if (document.length === 14) {
    return document.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  if (document.length === 11) {
    return document.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  return customer?.document ?? document;
}

function customerAddress(customer?: PublicQuoteCustomer | null) {
  const line = [customer?.addressStreet, customer?.addressNumber, customer?.addressComplement]
    .filter(Boolean)
    .join(", ");
  const cityLine = [customer?.addressDistrict, customer?.addressCity, customer?.addressState]
    .filter(Boolean)
    .join(" - ");
  return [line, cityLine, customer?.addressZip].filter(Boolean).join(" | ") || "Não informado";
}

function metaSnapshot(metadata: Record<string, unknown> | null | undefined) {
  const snapshot = metadata?.customerSnapshot;
  return snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>) : {};
}

export default function PublicQuotePage() {
  const params = useParams<{ quoteId: string }>();
  const searchParams = useSearchParams();
  const quoteId = params.quoteId;
  const token = searchParams.get("token") ?? "";
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  const items = useMemo(() => quote?.quote_items ?? [], [quote?.quote_items]);
  const subtotal = useMemo(
    () => quote?.subtotal ?? items.reduce((sum, item) => sum + numeric(item.total), 0),
    [items, quote?.subtotal],
  );
  const discount = quote?.discountAmount ?? 0;
  const tax = quote?.taxAmount ?? 0;
  const total = quote?.total ?? Math.max(0, numeric(subtotal) - numeric(discount)) + numeric(tax);
  const metadata = quote?.metadata ?? {};
  const snapshot = metaSnapshot(metadata);
  const customer = quote?.customer;
  const customerName =
    stringMeta(metadata, "contactName") ||
    (typeof snapshot.name === "string" ? snapshot.name : "") ||
    customer?.name ||
    "Não informado";
  const customerCompany =
    customer?.companyName ||
    (typeof snapshot.company === "string" ? snapshot.company : "") ||
    customer?.name ||
    "Cliente";
  const customerEmail =
    stringMeta(metadata, "customerEmail") ||
    (typeof snapshot.email === "string" ? snapshot.email : "") ||
    customer?.email ||
    "";
  const customerPhone =
    stringMeta(metadata, "customerPhone") ||
    (typeof snapshot.phone === "string" ? snapshot.phone : "") ||
    customer?.phone ||
    customer?.whatsapp ||
    "";
  const responsible = stringMeta(metadata, "responsible") || quote?.responsibleUser?.name || "Equipe comercial";
  const issueDate = shortDate(stringMeta(metadata, "issueDate") || quote?.createdAt);
  const validityDate = shortDate(quote?.validUntil);
  const paymentCondition = stringMeta(metadata, "paymentCondition") || "A combinar";
  const productionDeadline = stringMeta(metadata, "productionDeadline") || "A combinar";
  const acceptedAt = quote?.publicLinkAcceptedAt || stringMeta(metadata, "acceptedAt");

  useEffect(() => {
    let active = true;

    async function loadQuote() {
      if (!API_BASE_URL) {
        setError("API do GraficFlow não configurada.");
        setLoading(false);
        return;
      }

      if (!quoteId || !token) {
        setError("Link de orçamento inválido.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/public/quotes/${encodeURIComponent(quoteId)}?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message ?? "Não foi possível carregar este orçamento.");
        }

        if (active) setQuote(payload as PublicQuote);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar este orçamento.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadQuote();
    return () => {
      active = false;
    };
  }, [quoteId, token]);

  async function acceptQuote(event: FormEvent<HTMLFormElement>) {
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
      const response = await fetch(`${API_BASE_URL}/public/quotes/${encodeURIComponent(quoteId)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, token, acceptedByName, acceptedByEmail }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? "Não foi possível aceitar este orçamento.");
      }

      const acceptedAt = typeof payload?.acceptedAt === "string" ? payload.acceptedAt : new Date().toISOString();
      setAccepted(true);
      setQuote((current) =>
        current
          ? {
              ...current,
              status: "ACCEPTED",
              publicLinkAcceptedAt: acceptedAt,
              metadata: { ...(current.metadata ?? {}), acceptedAt },
            }
          : current,
      );
    } catch (acceptErrorResponse) {
      setAcceptError(
        acceptErrorResponse instanceof Error ? acceptErrorResponse.message : "Não foi possível aceitar este orçamento.",
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
            <FileText size={24} />
          </span>
          <div>
            <p>{quote?.tenant?.name ?? "GraficFlow"}</p>
            <h1>Orçamento {quote?.number ?? quoteId}</h1>
          </div>
          {quote ? <em>{statusLabel(quote.status)}</em> : null}
        </header>

        {loading ? (
          <div className="public-quote-state">
            <Loader2 size={26} />
            <strong>Carregando orçamento...</strong>
          </div>
        ) : error ? (
          <div className="public-quote-state error">
            <AlertCircle size={28} />
            <strong>{error}</strong>
          </div>
        ) : quote ? (
          <>
            <section className="public-quote-deadline-grid" aria-label="Prazos e validade do orçamento">
              <article>
                <span>
                  <CalendarDays size={19} />
                </span>
                <div>
                  <small>Data do orçamento</small>
                  <strong>{issueDate}</strong>
                </div>
              </article>
              <article>
                <span>
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <small>Validade do orçamento</small>
                  <strong>{validityDate}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Clock3 size={19} />
                </span>
                <div>
                  <small>Prazo de produção</small>
                  <strong>{productionDeadline}</strong>
                </div>
              </article>
              <article>
                <span>
                  <CreditCard size={19} />
                </span>
                <div>
                  <small>Condição de pagamento</small>
                  <strong>{paymentCondition}</strong>
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
                    <dd>{customerEmail || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Telefone</dt>
                    <dd>{customerPhone || "Não informado"}</dd>
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
                  <CalendarDays size={18} />
                  Informações do Orçamento
                </h2>
                <dl className="public-quote-details three">
                  <div>
                    <dt>Número</dt>
                    <dd>{quote.number ?? quote.id}</dd>
                  </div>
                  <div>
                    <dt>Data</dt>
                    <dd>{issueDate}</dd>
                  </div>
                  <div>
                    <dt>Validade</dt>
                    <dd>{validityDate}</dd>
                  </div>
                  <div>
                    <dt>Condição de Pagamento</dt>
                    <dd>{paymentCondition}</dd>
                  </div>
                  <div>
                    <dt>Prazo de Produção</dt>
                    <dd>{productionDeadline}</dd>
                  </div>
                  <div>
                    <dt>Responsável</dt>
                    <dd>{responsible}</dd>
                  </div>
                </dl>
              </article>
            </div>

            <div className="public-quote-body-grid">
              <div className="public-quote-main">
                <article className="public-quote-card">
                  <h2>Itens do Orçamento</h2>
                  <div className="public-quote-table">
                    <div className="public-quote-table-head">
                      <span>Produto / Serviço</span>
                      <span>Descrição</span>
                      <span>Qtd.</span>
                      <span>Un.</span>
                      <span>Valor Unit.</span>
                      <span>Valor Total</span>
                    </div>
                    {items.map((item) => (
                      <div className="public-quote-table-row" key={item.id}>
                        <strong>{item.description}</strong>
                        <span>{item.notes || "Acabamento e especificações conforme aprovado."}</span>
                        <span>{numeric(item.quantity).toLocaleString("pt-BR")}</span>
                        <span>un</span>
                        <span>{money(item.unitPrice)}</span>
                        <strong>{money(item.total)}</strong>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="public-quote-card">
                  <h2>Observações</h2>
                  <p className="public-quote-notes">
                    {quote.notes || "Orçamento sujeito à disponibilidade de estoque e aprovação da arte final."}
                  </p>
                </article>
              </div>

              <aside className="public-quote-card public-quote-total-card">
                <h2>Resumo do Orçamento</h2>
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
                    Impostos (5%)
                    <strong>{money(tax)}</strong>
                  </span>
                </div>
                <div className="public-quote-total-line">
                  <span>Total</span>
                  <strong>{money(total)}</strong>
                </div>
                <div className="public-quote-validity">
                  <ShieldCheck size={18} />
                  Este orçamento é válido até {validityDate}
                </div>
                <div className="public-quote-validity public-quote-deadline-note">
                  <Clock3 size={18} />
                  Prazo de produção: {productionDeadline}
                </div>

                {accepted || quote.status === "ACCEPTED" ? (
                  <div className="public-quote-accepted">
                    <CheckCircle2 size={22} />
                    <div>
                      <strong>Orçamento aceito.</strong>
                      <small>
                        {dateTime(acceptedAt) ? `Aceito em ${dateTime(acceptedAt)}.` : "Aceite confirmado."} Sem cancelamento por este link.
                      </small>
                    </div>
                  </div>
                ) : (
                  <form className="public-quote-accept" onSubmit={acceptQuote}>
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
                      {accepting ? "Confirmando..." : "Aceitar orçamento"}
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
