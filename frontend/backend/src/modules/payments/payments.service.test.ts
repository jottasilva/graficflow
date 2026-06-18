import { strict as assert } from "node:assert";
import test from "node:test";
import type { AuthContext } from "../../http/middleware/auth.js";
import type { SupabaseServiceClient } from "../../shared/supabase/client.js";
import { PaymentsService } from "./payments.service.js";

type QueryResult = { data: unknown; error: null };
type MockCall = {
  table: string;
  operation: "select" | "update";
  columns?: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
};

class MockQuery {
  constructor(
    private readonly result: QueryResult,
    private readonly call: MockCall,
  ) {}

  select(columns = "*") {
    this.call.columns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.filters.push([column, value]);
    return this;
  }

  maybeSingle<T>() {
    return Promise.resolve(this.result as { data: T | null; error: null });
  }

  single<T>() {
    return Promise.resolve(this.result as { data: T; error: null });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function createSupabaseMock(results: QueryResult[]) {
  const calls: MockCall[] = [];

  return {
    calls,
    client: {
      from(table: string) {
        return {
          select(columns = "*") {
            const call: MockCall = { table, operation: "select", columns, filters: [] };
            calls.push(call);
            return new MockQuery(results.shift() ?? { data: null, error: null }, call);
          },
          update(payload: unknown) {
            const call: MockCall = { table, operation: "update", payload, filters: [] };
            calls.push(call);
            return new MockQuery(results.shift() ?? { data: null, error: null }, call);
          },
        };
      },
    } as unknown as SupabaseServiceClient,
  };
}

const auth: AuthContext = {
  token: "test-token",
  userId: "usr-1",
  tenantId: "tenant-1",
  email: "admin@email.com",
  role: "ADMIN",
  permissions: ["*"],
  sectorIds: [],
  provider: "supabase",
  claims: {},
};

test("payment update recalculates paid amount when a paid order payment is canceled", async () => {
  const { client, calls } = createSupabaseMock([
    {
      data: {
        id: "pay-1",
        tenantId: "tenant-1",
        orderId: "ord-1",
        purchaseOrderId: null,
        direction: "incoming",
        amount: 500,
        status: "PAID",
      },
      error: null,
    },
    {
      data: {
        id: "pay-1",
        tenantId: "tenant-1",
        orderId: "ord-1",
        purchaseOrderId: null,
        direction: "incoming",
        amount: 500,
        status: "CANCELED",
      },
      error: null,
    },
    {
      data: {
        id: "ord-1",
        tenantId: "tenant-1",
        total: 500,
        paidAmount: 500,
      },
      error: null,
    },
    { data: [], error: null },
    { data: null, error: null },
  ]);
  const service = new PaymentsService(client, { record: async () => undefined });

  await service.update("pay-1", { status: "CANCELED" }, auth);

  const orderUpdate = calls.find((call) => call.table === "orders" && call.operation === "update");
  assert.deepEqual(orderUpdate?.payload, {
    paidAmount: 0,
    remainingAmount: 500,
    paymentStatus: "PENDING",
    updatedAt: orderUpdate && typeof (orderUpdate.payload as { updatedAt?: unknown }).updatedAt === "string"
      ? (orderUpdate.payload as { updatedAt: string }).updatedAt
      : undefined,
  });
});
