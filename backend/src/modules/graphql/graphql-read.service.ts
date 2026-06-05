import type { Env } from "../../config/env.js";
import type { AuthContext } from "../../http/middleware/auth.js";
import { assertTenantAccess } from "../../http/middleware/auth.js";
import { upstreamError } from "../../shared/errors/http-error.js";

type GraphqlEdge<T> = {
  node: T;
};

type GraphqlCollection<T> = {
  edges: Array<GraphqlEdge<T>>;
};

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
  ordersCollection: GraphqlCollection<DashboardOrder>;
  customersCollection: GraphqlCollection<DashboardCustomer>;
  quotesCollection: GraphqlCollection<DashboardQuote>;
  machinesCollection: GraphqlCollection<DashboardMachine>;
};

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; path?: Array<string | number> }>;
};

const DASHBOARD_OVERVIEW_QUERY = /* GraphQL */ `
  query GraphFlowDashboardOverview($tenantId: String!) {
    ordersCollection(first: 100, filter: { tenantId: { eq: $tenantId } }) {
      edges {
        node {
          id
          number
          status
          paymentStatus
          productionStatus
          total
          createdAt
          deletedAt
        }
      }
    }
    customersCollection(first: 100, filter: { tenantId: { eq: $tenantId } }) {
      edges {
        node {
          id
          name
          status
          createdAt
          deletedAt
        }
      }
    }
    quotesCollection(first: 100, filter: { tenantId: { eq: $tenantId } }) {
      edges {
        node {
          id
          number
          status
          total
          createdAt
          deletedAt
        }
      }
    }
    machinesCollection(first: 100, filter: { tenantId: { eq: $tenantId } }) {
      edges {
        node {
          id
          name
          status
          createdAt
        }
      }
    }
  }
`;

function nodes<T>(collection: GraphqlCollection<T>): T[] {
  return collection.edges.map((edge) => edge.node);
}

function activeRows<T extends { deletedAt?: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => !row.deletedAt);
}

function numeric(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function sortByCreatedAt<T extends { createdAt: string | null }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? ""));
}

export class GraphqlReadService {
  private readonly endpoint: string;

  constructor(private readonly env: Env) {
    this.endpoint = `${env.SUPABASE_URL.replace(/\/$/, "")}/graphql/v1`;
  }

  async dashboardOverview(tenantId: string, auth: AuthContext) {
    assertTenantAccess(auth, tenantId);

    const data = await this.query<DashboardGraphqlData>(DASHBOARD_OVERVIEW_QUERY, { tenantId });

    const orders = activeRows(nodes(data.ordersCollection));
    const customers = activeRows(nodes(data.customersCollection));
    const quotes = activeRows(nodes(data.quotesCollection));
    const machines = nodes(data.machinesCollection);

    return {
      source: "supabase-pg_graphql",
      tenantId,
      queriedAt: new Date().toISOString(),
      totals: {
        customers: customers.length,
        activeCustomers: customers.filter((customer) => customer.status !== "INACTIVE").length,
        orders: orders.length,
        openOrders: orders.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELED").length,
        productionOrders: orders.filter((order) => order.productionStatus === "IN_PROGRESS").length,
        revenue: orders.reduce((sum, order) => sum + numeric(order.total), 0),
        quotes: quotes.length,
        acceptedQuotes: quotes.filter((quote) => quote.status === "ACCEPTED").length,
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

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = (await response.json().catch(() => null)) as GraphqlResponse<T> | null;

    if (!response.ok || !payload) {
      throw upstreamError("Falha ao consultar GraphQL do Supabase.", {
        status: response.status,
      });
    }

    if (payload.errors?.length) {
      throw upstreamError("GraphQL retornou erro.", payload.errors);
    }

    if (!payload.data) {
      throw upstreamError("GraphQL nao retornou dados.");
    }

    return payload.data;
  }
}
