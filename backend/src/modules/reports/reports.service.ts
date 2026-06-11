import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { ReportQueryInput } from "../../http/schemas.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";
import { roundMoney } from "../../shared/utils/money.js";

type MoneyRow = {
  value?: number | string | null;
  total?: number | string | null;
  amount?: number | string | null;
  type?: string | null;
  status?: string | null;
  direction?: string | null;
  productionStatus?: string | null;
  expectedDeliveryAt?: string | null;
  feeAmount?: number | string | null;
};

function numeric(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function sum(rows: MoneyRow[], field: "value" | "total" | "amount", predicate: (row: MoneyRow) => boolean = () => true): number {
  return roundMoney(rows.filter(predicate).reduce((total, row) => total + numeric(row[field]), 0));
}

function applyDateRange<T>(query: T, input: ReportQueryInput): T {
  const withRange = query as T & {
    gte(column: string, value: string): T;
    lte(column: string, value: string): T;
  };

  let scoped = query;
  if (input.dateFrom) scoped = withRange.gte("createdAt", `${input.dateFrom}T00:00:00.000Z`);
  if (input.dateTo) scoped = withRange.lte("createdAt", `${input.dateTo}T23:59:59.999Z`);
  return scoped;
}

export class ReportsService {
  constructor(private readonly supabase: SupabaseServiceClient) {}

  async management(input: ReportQueryInput, auth: AuthContext) {
    assertTenantAccess(auth, input.tenantId);

    const ordersQuery = applyDateRange(
      this.supabase
        .from("orders")
        .select("id,total,status,paymentStatus,productionStatus,expectedDeliveryAt")
        .eq("tenantId", input.tenantId)
        .is("deletedAt", null),
      input,
    );
    const quotesQuery = applyDateRange(
      this.supabase.from("quotes").select("id,total,status").eq("tenantId", input.tenantId).is("deletedAt", null),
      input,
    );
    const financeQuery = applyDateRange(
      this.supabase.from("financial_transactions").select("id,type,value,status").eq("tenantId", input.tenantId),
      input,
    );
    const purchasesQuery = applyDateRange(
      this.supabase
        .from("purchase_orders")
        .select("id,total,status,paymentStatus")
        .eq("tenantId", input.tenantId)
        .is("deletedAt", null),
      input,
    );
    const paymentsQuery = applyDateRange(
      this.supabase.from("payment_transactions").select("id,direction,amount,status,feeAmount").eq("tenantId", input.tenantId),
      input,
    );
    const fiscalQuery = applyDateRange(
      this.supabase.from("fiscal_documents").select("id,type,status,environment").eq("tenantId", input.tenantId),
      input,
    );
    const qualityQuery = applyDateRange(
      this.supabase.from("quality_inspections").select("id,status,checkedQty,rejectedQty").eq("tenantId", input.tenantId),
      input,
    );

    const [orders, quotes, finance, purchases, payments, fiscal, quality, inventory, machines] = await Promise.all([
      ordersQuery,
      quotesQuery,
      financeQuery,
      purchasesQuery,
      paymentsQuery,
      fiscalQuery,
      qualityQuery,
      this.supabase.from("inventories").select("id,quantity,minQuantity,availableQuantity").eq("tenantId", input.tenantId),
      this.supabase.from("machines").select("id,status,totalUsageMinutes,costMonth").eq("tenantId", input.tenantId),
    ]);

    assertSupabaseOk(orders.error, "relatorio de pedidos");
    assertSupabaseOk(quotes.error, "relatorio de orcamentos");
    assertSupabaseOk(finance.error, "relatorio financeiro");
    assertSupabaseOk(purchases.error, "relatorio de compras");
    assertSupabaseOk(payments.error, "relatorio de pagamentos");
    assertSupabaseOk(fiscal.error, "relatorio fiscal");
    assertSupabaseOk(quality.error, "relatorio de qualidade");
    assertSupabaseOk(inventory.error, "relatorio de estoque");
    assertSupabaseOk(machines.error, "relatorio de maquinas");

    const orderRows = (orders.data ?? []) as MoneyRow[];
    const quoteRows = (quotes.data ?? []) as MoneyRow[];
    const financeRows = (finance.data ?? []) as MoneyRow[];
    const purchaseRows = (purchases.data ?? []) as MoneyRow[];
    const paymentRows = (payments.data ?? []) as Array<MoneyRow & { direction?: string | null; feeAmount?: number | string | null }>;
    const fiscalRows = fiscal.data ?? [];
    const qualityRows = quality.data ?? [];
    const inventoryRows = inventory.data ?? [];
    const machineRows = machines.data ?? [];

    const now = Date.now();
    const overdueOrders = (orders.data ?? []).filter((order) => {
      const due = Date.parse(String(order.expectedDeliveryAt ?? ""));
      return Number.isFinite(due) && due < now && !["DELIVERED", "CANCELED", "REFUNDED"].includes(String(order.status));
    }).length;
    const lowStock = inventoryRows.filter((item) => numeric(item.availableQuantity ?? item.quantity) <= numeric(item.minQuantity)).length;
    const checkedQty = qualityRows.reduce((total, row) => total + numeric(row.checkedQty), 0);
    const rejectedQty = qualityRows.reduce((total, row) => total + numeric(row.rejectedQty), 0);

    return {
      tenantId: input.tenantId,
      period: {
        from: input.dateFrom ?? null,
        to: input.dateTo ?? null,
      },
      generatedAt: new Date().toISOString(),
      sales: {
        orders: orderRows.length,
        openOrders: orderRows.filter((row) => !["DELIVERED", "CANCELED", "REFUNDED"].includes(String(row.status))).length,
        overdueOrders,
        confirmedRevenue: sum(orderRows, "total", (row) => !["CANCELED", "REFUNDED"].includes(String(row.status))),
        averageTicket: orderRows.length ? roundMoney(sum(orderRows, "total") / orderRows.length) : 0,
      },
      quotes: {
        total: quoteRows.length,
        accepted: quoteRows.filter((row) => ["ACCEPTED", "CONVERTED"].includes(String(row.status))).length,
        openValue: sum(quoteRows, "total", (row) => ["DRAFT", "SENT", "VIEWED"].includes(String(row.status))),
      },
      finance: {
        receivable: sum(financeRows, "value", (row) => row.type === "receivable"),
        payable: sum(financeRows, "value", (row) => row.type === "payable"),
        received: sum(financeRows, "value", (row) => row.status === "Recebido"),
        projectedCash: sum(financeRows, "value", (row) => row.type === "cash" || row.status === "Projetado"),
      },
      purchases: {
        total: purchaseRows.length,
        open: purchaseRows.filter((row) => !["RECEIVED", "CANCELED"].includes(String(row.status))).length,
        committedCost: sum(purchaseRows, "total", (row) => row.status !== "CANCELED"),
      },
      payments: {
        incomingPaid: sum(paymentRows, "amount", (row) => row.direction === "incoming" && row.status === "PAID"),
        outgoingPaid: sum(paymentRows, "amount", (row) => row.direction === "outgoing" && row.status === "PAID"),
        fees: roundMoney(paymentRows.reduce((total, row) => total + numeric(row.feeAmount), 0)),
        pending: paymentRows.filter((row) => ["PENDING", "AUTHORIZED"].includes(String(row.status))).length,
      },
      production: {
        inProgress: orderRows.filter((row) => ["IN_QUEUE", "PICKING", "IN_PROGRESS", "PACKING"].includes(String(row.productionStatus))).length,
        machines: machineRows.length,
        machinesDown: machineRows.filter((row) => ["DOWN", "MAINTENANCE"].includes(String(row.status))).length,
        lowStock,
      },
      fiscal: {
        total: fiscalRows.length,
        authorized: fiscalRows.filter((row) => row.status === "AUTHORIZED").length,
        rejected: fiscalRows.filter((row) => row.status === "REJECTED").length,
        queued: fiscalRows.filter((row) => ["QUEUED", "PROCESSING"].includes(String(row.status))).length,
      },
      quality: {
        inspections: qualityRows.length,
        rejectedRate: checkedQty ? roundMoney((rejectedQty / checkedQty) * 100) : 0,
        rework: qualityRows.filter((row) => row.status === "REWORK").length,
      },
    };
  }
}
