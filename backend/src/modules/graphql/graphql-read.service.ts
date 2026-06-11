import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { assertSupabaseOk } from "../../shared/supabase/result.js";

type DashboardOrder = {
  id: string;
  number: string | null;
  status: string | null;
  paymentStatus: string | null;
  productionStatus: string | null;
  total: number | string | null;
  createdAt: string | null;
  deletedAt: string | null;
};

type DashboardCustomer = {
  id: string;
  name: string;
  status: string | null;
  createdAt: string | null;
  deletedAt: string | null;
};

type DashboardQuote = {
  id: string;
  number: string | null;
  status: string | null;
  total: number | string | null;
  createdAt: string | null;
  deletedAt: string | null;
};

type DashboardMachine = {
  id: string;
  name: string;
  status: string | null;
  createdAt: string | null;
};

type DashboardGraphqlData = {
  orders: DashboardOrder[];
  customers: DashboardCustomer[];
  quotes: DashboardQuote[];
  machines: DashboardMachine[];
};

const DASHBOARD_PAGE_SIZE = 1000;

function numeric(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function sortByCreatedAt<T extends { createdAt: string | null }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? ""));
}

export class GraphqlReadService {
  constructor(private readonly supabase: SupabaseServiceClient) {}

  async dashboardOverview(tenantId: string, auth: AuthContext) {
    assertTenantAccess(auth, tenantId);

    const data = await this.dashboardRows(tenantId);

    const orders = data.orders;
    const customers = data.customers;
    const quotes = data.quotes;
    const machines = data.machines;

    return {
      source: "supabase-rest",
      tenantId,
      queriedAt: new Date().toISOString(),
      totals: {
        customers: customers.length,
        activeCustomers: customers.filter((customer) => customer.status !== "INACTIVE").length,
        orders: orders.length,
        openOrders: orders.filter((order) => !["DELIVERED", "CANCELED", "REFUNDED"].includes(String(order.status))).length,
        productionOrders: orders.filter((order) => order.productionStatus === "IN_PROGRESS").length,
        revenue: orders.reduce((sum, order) => sum + numeric(order.total), 0),
        quotes: quotes.length,
        acceptedQuotes: quotes.filter((quote) => ["ACCEPTED", "CONVERTED"].includes(String(quote.status))).length,
        machines: machines.length,
        machinesInMaintenance: machines.filter((machine) => machine.status === "MAINTENANCE").length,
      },
      recent: {
        orders: sortByCreatedAt(orders).slice(0, 6),
        quotes: sortByCreatedAt(quotes).slice(0, 6),
        customers: sortByCreatedAt(customers).slice(0, 6),
      },
    };
  }

  private async dashboardRows(tenantId: string): Promise<DashboardGraphqlData> {
    const [orders, customers, quotes, machines] = await Promise.all([
      this.fetchAll<DashboardOrder>(
        "orders",
        "id,number,status,paymentStatus,productionStatus,total,createdAt,deletedAt",
        tenantId,
        { excludeDeleted: true, label: "pedidos do dashboard" },
      ),
      this.fetchAll<DashboardCustomer>(
        "customers",
        "id,name,status,createdAt,deletedAt",
        tenantId,
        { excludeDeleted: true, label: "clientes do dashboard" },
      ),
      this.fetchAll<DashboardQuote>(
        "quotes",
        "id,number,status,total,createdAt,deletedAt",
        tenantId,
        { excludeDeleted: true, label: "orcamentos do dashboard" },
      ),
      this.fetchAll<DashboardMachine>(
        "machines",
        "id,name,status,createdAt",
        tenantId,
        { label: "maquinas do dashboard" },
      ),
    ]);

    return { orders, customers, quotes, machines };
  }

  private async fetchAll<T>(
    table: string,
    columns: string,
    tenantId: string,
    options: { excludeDeleted?: boolean; label: string },
  ): Promise<T[]> {
    const rows: T[] = [];
    let from = 0;

    while (true) {
      let query = this.supabase
        .from(table)
        .select(columns)
        .eq("tenantId", tenantId)
        .order("createdAt", { ascending: false })
        .range(from, from + DASHBOARD_PAGE_SIZE - 1);

      if (options.excludeDeleted) {
        query = query.is("deletedAt", null);
      }

      const result = await query;
      assertSupabaseOk(result.error, `listar ${options.label}`);

      const page = (result.data ?? []) as T[];
      rows.push(...page);

      if (page.length < DASHBOARD_PAGE_SIZE) {
        break;
      }

      from += DASHBOARD_PAGE_SIZE;
    }

    return rows;
  }
}
