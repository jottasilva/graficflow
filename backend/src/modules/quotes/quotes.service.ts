import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import type { Env } from "../../config/env.js";
import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type {
  AcceptQuoteInput,
  CreateQuoteInput,
  UpdateQuoteInput,
} from "../../http/schemas.js";
import { gone, notFound, unauthorized } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { documentNumber, randomId, randomToken } from "../../shared/utils/ids.js";
import { lineTotal, subtotal } from "../../shared/utils/money.js";
import { stripUndefined } from "../../shared/utils/objects.js";

type QuoteListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

type PublicTokenRow = {
  id: string;
  quoteId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export class QuotesService {
  constructor(
    private readonly supabase: SupabaseServiceClient,
    private readonly env: Env,
  ) {}

  async list(input: QuoteListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("quotes")
      .select("*,quote_items(*)", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .is("deletedAt", null)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      query = query.ilike("number", `%${input.search}%`);
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar orcamentos");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async create(input: CreateQuoteInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const now = new Date().toISOString();
    const quoteId = randomId("quo");
    const total = subtotal(input.items);
    const rawToken = randomToken();
    const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const quoteResult = await this.supabase
      .from("quotes")
      .insert({
        id: quoteId,
        tenantId: input.tenantId,
        customerId: input.customerId,
        userId: auth.userId,
        number: documentNumber("ORC"),
        status: input.sendNow ? "SENT" : "DRAFT",
        validUntil: input.validUntil,
        notes: input.notes ?? null,
        internalNotes: input.internalNotes ?? null,
        subtotal: total,
        discountAmount: 0,
        taxAmount: 0,
        total,
        metadata: {
          publicLinkCreatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(quoteResult.error, "criar orcamento");

    const items = input.items.map((item) => ({
      id: randomId("qit"),
      tenantId: input.tenantId,
      quoteId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: lineTotal(item),
      notes: item.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }));

    const itemsResult = await this.supabase.from("quote_items").insert(items).select("*");
    assertSupabaseOk(itemsResult.error, "criar itens do orcamento");

    const tokenResult = await this.supabase
      .from("quote_public_tokens")
      .insert({
        id: randomId("qtk"),
        tenantId: input.tenantId,
        quoteId,
        tokenHash: this.hashToken(rawToken),
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .select("id,expiresAt")
      .single();

    assertSupabaseOk(tokenResult.error, "criar link publico do orcamento");

    return {
      ...quoteResult.data,
      quote_items: itemsResult.data ?? [],
      publicLink: this.publicQuoteLink(quoteId, rawToken),
      publicLinkExpiresAt: expiresAt,
    };
  }

  async update(id: string, input: UpdateQuoteInput, auth: AuthContext) {
    const current = await this.getQuoteTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase
      .from("quotes")
      .update(stripUndefined({ ...input, updatedAt: new Date().toISOString() }))
      .eq("id", id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar orcamento");
    return result.data;
  }

  async getPublicQuote(quoteId: string, token: string) {
    const publicToken = await this.verifyPublicToken(quoteId, token);

    const quote = await this.supabase
      .from("quotes")
      .select("*,quote_items(*)")
      .eq("id", publicToken.quoteId)
      .maybeSingle();

    assertSupabaseOk(quote.error, "buscar orcamento publico");
    if (!quote.data) throw notFound("Orcamento nao encontrado.");

    if (quote.data.status === "SENT") {
      await this.supabase.from("quotes").update({ status: "VIEWED" }).eq("id", quoteId);
    }

    return quote.data;
  }

  async accept(input: AcceptQuoteInput) {
    const publicToken = await this.verifyPublicToken(input.quoteId, input.token);
    const now = new Date().toISOString();

    const quote = await this.supabase
      .from("quotes")
      .update({
        status: "ACCEPTED",
        metadata: {
          acceptedAt: now,
          acceptedByName: input.acceptedByName,
          acceptedByEmail: input.acceptedByEmail,
          acceptedIp: input.acceptedIp ?? null,
        },
        updatedAt: now,
      })
      .eq("id", publicToken.quoteId)
      .select("*")
      .single();

    assertSupabaseOk(quote.error, "aceitar orcamento");

    const tokenUpdate = await this.supabase
      .from("quote_public_tokens")
      .update({ acceptedAt: now, updatedAt: now })
      .eq("id", publicToken.id);
    assertSupabaseOk(tokenUpdate.error, "registrar aceite do link");

    return {
      accepted: true,
      quote: quote.data,
    };
  }

  async generatePdf(id: string, auth: AuthContext): Promise<Buffer> {
    const current = await this.getQuoteTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase.from("quotes").select("*,quote_items(*)").eq("id", id).single();
    assertSupabaseOk(result.error, "buscar dados do PDF");

    return renderQuotePdf(result.data);
  }

  private async getQuoteTenant(id: string): Promise<{ id: string; tenantId: string }> {
    const result = await this.supabase
      .from("quotes")
      .select("id,tenantId")
      .eq("id", id)
      .maybeSingle<{ id: string; tenantId: string }>();

    assertSupabaseOk(result.error, "buscar orcamento");
    if (!result.data) throw notFound("Orcamento nao encontrado.");
    return result.data;
  }

  private async verifyPublicToken(quoteId: string, token: string): Promise<PublicTokenRow> {
    const result = await this.supabase
      .from("quote_public_tokens")
      .select("*")
      .eq("quoteId", quoteId)
      .eq("tokenHash", this.hashToken(token))
      .is("revokedAt", null)
      .maybeSingle<PublicTokenRow>();

    assertSupabaseOk(result.error, "validar link publico");
    if (!result.data) throw unauthorized("Link de orcamento invalido.");

    if (result.data.acceptedAt) {
      throw gone("Orcamento ja foi aceito por este link.");
    }

    if (Date.parse(result.data.expiresAt) < Date.now()) {
      throw gone("Link de orcamento expirado.");
    }

    return result.data;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(`${token}.${this.env.QUOTE_PUBLIC_TOKEN_PEPPER}`).digest("hex");
  }

  private publicQuoteLink(quoteId: string, token: string): string {
    const base = this.env.PUBLIC_APP_URL.replace(/\/$/, "");
    return `${base}/orcamentos/${quoteId}?token=${encodeURIComponent(token)}`;
  }
}

function renderQuotePdf(quote: Record<string, unknown>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text("GraphFlow - Orcamento", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Numero: ${String(quote.number ?? quote.id)}`);
    doc.text(`Status: ${String(quote.status ?? "")}`);
    doc.text(`Validade: ${String(quote.validUntil ?? "")}`);
    doc.moveDown();

    const items = Array.isArray(quote.quote_items) ? quote.quote_items : [];
    doc.fontSize(13).text("Itens");
    doc.moveDown(0.4);

    for (const item of items as Array<Record<string, unknown>>) {
      doc
        .fontSize(10)
        .text(
          `${String(item.description ?? "Item")} - ${String(item.quantity ?? 0)} x R$ ${String(
            item.unitPrice ?? 0,
          )} = R$ ${String(item.total ?? 0)}`,
        );
    }

    doc.moveDown();
    doc.fontSize(14).text(`Total: R$ ${String(quote.total ?? 0)}`, { align: "right" });
    doc.end();
  });
}
