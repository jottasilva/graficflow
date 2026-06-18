import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { CreatePaymentTransactionInput, UpdatePaymentTransactionInput } from "../../http/schemas.js";
import { badRequest, notFound } from "../../shared/errors/http-error.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { randomId } from "../../shared/utils/ids.js";
import { roundMoney } from "../../shared/utils/money.js";
import { stripUndefined } from "../../shared/utils/objects.js";
import type { AuditService } from "../audit/audit.service.js";

type PaymentListInput = {
  tenantId: string;
  search?: string;
  page: number;
  pageSize: number;
};

type PayableRow = {
  id: string;
  tenantId: string;
  total: number | string;
  paidAmount: number | string;
};

type PaymentRow = {
  id: string;
  tenantId: string;
  orderId: string | null;
  purchaseOrderId: string | null;
  direction: "incoming" | "outgoing";
  amount: number | string;
  status: string;
};

export class PaymentsService {
  constructor(
    private readonly supabase: SupabaseServiceClient,
    private readonly audit: AuditService,
  ) {}

  async list(input: PaymentListInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;

    let query = this.supabase
      .from("payment_transactions")
      .select("*", { count: "exact" })
      .eq("tenantId", input.tenantId)
      .order("createdAt", { ascending: false })
      .range(from, to);

    if (input.search) {
      query = query.or(
        [
          `provider.ilike.%${input.search}%`,
          `providerReference.ilike.%${input.search}%`,
          `method.ilike.%${input.search}%`,
        ].join(","),
      );
    }

    const result = await query;
    assertSupabaseOk(result.error, "listar pagamentos");

    return {
      data: result.data ?? [],
      page: input.page,
      pageSize: input.pageSize,
      total: result.count ?? 0,
    };
  }

  async create(input: CreatePaymentTransactionInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);
    this.assertReference(input);

    const now = new Date().toISOString();
    const paidAt = input.status === "PAID" ? input.paidAt ?? now : input.paidAt ?? null;
    const result = await this.supabase
      .from("payment_transactions")
      .insert({
        id: randomId("pay"),
        tenantId: input.tenantId,
        orderId: input.orderId ?? null,
        quoteId: input.quoteId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        financeId: input.financeId ?? null,
        direction: input.direction,
        method: input.method,
        provider: input.provider ?? null,
        providerReference: input.providerReference ?? null,
        amount: input.amount,
        feeAmount: input.feeAmount,
        netAmount: roundMoney(input.amount - input.feeAmount),
        status: input.status,
        dueAt: input.dueAt ?? null,
        paidAt,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      })
      .select("*")
      .single();

    assertSupabaseOk(result.error, "criar pagamento");

    const payment = result.data as PaymentRow;
    await this.syncPaidReference(payment);

    await this.audit.record({
      tenantId: input.tenantId,
      userId: auth.userId,
      action: "payment.create",
      entityType: "payment_transaction",
      entityId: payment.id,
      after: payment,
    });

    return payment;
  }

  async update(id: string, input: UpdatePaymentTransactionInput, auth: AuthContext) {
    const current = await this.getTenant(id);
    assertTenantAccess(auth, current.tenantId);

    const result = await this.supabase
      .from("payment_transactions")
      .update(stripUndefined({ ...input, updatedAt: new Date().toISOString() }))
      .eq("id", id)
      .select("*")
      .single();

    assertSupabaseOk(result.error, "atualizar pagamento");
    const payment = result.data as PaymentRow;

    await this.syncPaidReference(payment);

    await this.audit.record({
      tenantId: current.tenantId,
      userId: auth.userId,
      action: "payment.update",
      entityType: "payment_transaction",
      entityId: id,
      before: current,
      after: payment,
    });

    return payment;
  }

  private assertReference(input: CreatePaymentTransactionInput) {
    if (!input.orderId && !input.quoteId && !input.purchaseOrderId && !input.financeId) {
      throw badRequest("Informe uma referencia para o pagamento.");
    }
  }

  private async syncPaidReference(payment: PaymentRow) {
    if (payment.direction === "incoming" && payment.orderId) {
      await this.recalculatePaidAmount("orders", payment.orderId, "orderId", "incoming");
    }

    if (payment.direction === "outgoing" && payment.purchaseOrderId) {
      await this.recalculatePaidAmount("purchase_orders", payment.purchaseOrderId, "purchaseOrderId", "outgoing");
    }
  }

  private async recalculatePaidAmount(
    table: "orders" | "purchase_orders",
    id: string,
    paymentReferenceColumn: "orderId" | "purchaseOrderId",
    direction: "incoming" | "outgoing",
  ) {
    const current = await this.supabase
      .from(table)
      .select("id,tenantId,total,paidAmount")
      .eq("id", id)
      .maybeSingle<PayableRow>();

    assertSupabaseOk(current.error, "buscar referencia do pagamento");
    if (!current.data) throw notFound("Referencia do pagamento nao encontrada.");

    const payments = await this.supabase
      .from("payment_transactions")
      .select("amount")
      .eq("tenantId", current.data.tenantId)
      .eq(paymentReferenceColumn, id)
      .eq("direction", direction)
      .eq("status", "PAID");

    assertSupabaseOk(payments.error, "somar pagamentos da referencia");

    const total = Number(current.data.total ?? 0);
    const paidAmount = roundMoney((payments.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0));
    const remainingAmount = Math.max(0, roundMoney(total - paidAmount));
    const paymentStatus = remainingAmount === 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING";

    const update = await this.supabase
      .from(table)
      .update({
        paidAmount,
        remainingAmount,
        paymentStatus,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id);

    assertSupabaseOk(update.error, "atualizar saldo da referencia do pagamento");
  }

  private async getTenant(id: string): Promise<PaymentRow> {
    const result = await this.supabase
      .from("payment_transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle<PaymentRow>();

    assertSupabaseOk(result.error, "buscar pagamento");
    if (!result.data) throw notFound("Pagamento nao encontrado.");
    return result.data;
  }
}
