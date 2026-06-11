import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createClientSchema,
  createFiscalDocumentSchema,
  createOrderSchema,
  createPaymentTransactionSchema,
  createProductSchema,
  createPurchaseOrderSchema,
  createQualityInspectionSchema,
  createSupplierSchema,
  loginSchema,
  registerSchema,
  tenantQuerySchema,
} from "./schemas.js";

const fiscal = {
  ncm: "49111090",
  origin: "0",
  cfop: "5102",
  icmsCstCsosn: "102",
  pisCst: "01",
  cofinsCst: "01",
  icmsRate: "18",
  pisRate: "1.65",
  cofinsRate: "7.6",
};

describe("http schemas", () => {
  it("normalizes login email and default remember flag", () => {
    const parsed = loginSchema.parse({
      email: " ADMIN@GraphFlow.COM ",
      password: "secret",
    });

    assert.deepEqual(parsed, {
      email: "admin@graphflow.com",
      password: "secret",
      remember: true,
    });
  });

  it("rejects registration when password confirmation differs", () => {
    const result = registerSchema.safeParse({
      name: "Ana Silva",
      companyName: "Grafica Ana",
      email: "ana@example.com",
      password: "Senha123",
      passwordConfirmation: "Senha124",
    });

    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0]?.path.join("."), "passwordConfirmation");
  });

  it("applies pagination defaults and validates tenant query bounds", () => {
    const parsed = tenantQuerySchema.parse({ tenantId: "graphflow-main" });

    assert.equal(parsed.page, 1);
    assert.equal(parsed.pageSize, 25);
    assert.equal(parsed.tenantId, "graphflow-main");
  });

  it("validates client document type against person type", () => {
    const result = createClientSchema.safeParse({
      tenantId: "graphflow-main",
      personType: "PJ",
      documentType: "CPF",
      document: "12345678901",
      name: "Cliente Teste",
      email: "cliente@example.com",
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.issues.some((issue) => issue.path.join(".") === "documentType"));
  });

  it("requires fiscal and commercial metadata for product creation", () => {
    const missingFiscal = createProductSchema.safeParse({
      tenantId: "graphflow-main",
      sku: "SKU-001",
      name: "Cartao de visita",
      category: "Impressos",
      priceCost: 10,
      priceSale: 29.9,
      attributes: {
        commercialDescription: "Cartao couchê 300g",
        gtin: "SEM GTIN",
      },
    });

    assert.equal(missingFiscal.success, false);
    assert.ok(missingFiscal.error?.issues.some((issue) => issue.path.join(".") === "attributes.fiscal"));

    const valid = createProductSchema.parse({
      tenantId: "graphflow-main",
      sku: "SKU-001",
      name: "Cartao de visita",
      category: "Impressos",
      priceCost: 10,
      priceSale: 29.9,
      attributes: {
        commercialDescription: "Cartao couchê 300g",
        gtin: "SEM GTIN",
        fiscal,
      },
    });

    assert.equal(valid.unitType, "UN");
    assert.equal(valid.trackStock, true);
  });

  it("requires at least one order item and coerces item numbers", () => {
    const emptyOrder = createOrderSchema.safeParse({
      tenantId: "graphflow-main",
      customerId: "cli_1",
      items: [],
    });

    assert.equal(emptyOrder.success, false);

    const order = createOrderSchema.parse({
      tenantId: "graphflow-main",
      customerId: "cli_1",
      items: [
        {
          productId: "prod_1",
          description: "Banner lona",
          quantity: "2",
          unitPrice: "59.9",
        },
      ],
    });

    assert.equal(order.items[0]?.quantity, 2);
    assert.equal(order.items[0]?.unitPrice, 59.9);
    assert.equal(order.items[0]?.priority, "NORMAL");
  });

  it("validates supplier document by document type", () => {
    const invalid = createSupplierSchema.safeParse({
      tenantId: "graphflow-main",
      documentType: "CNPJ",
      document: "123",
      name: "Fornecedor Papel",
    });

    assert.equal(invalid.success, false);
    assert.ok(invalid.error?.issues.some((issue) => issue.path.join(".") === "document"));

    const valid = createSupplierSchema.parse({
      tenantId: "graphflow-main",
      documentType: "CNPJ",
      document: "11222333000144",
      name: "Fornecedor Papel",
    });

    assert.equal("status" in valid, false);
    assert.deepEqual(valid.categories, []);
  });

  it("requires purchase orders to have items and calculates valid money fields", () => {
    const empty = createPurchaseOrderSchema.safeParse({
      tenantId: "graphflow-main",
      supplierId: "sup_1",
      items: [],
    });

    assert.equal(empty.success, false);

    const parsed = createPurchaseOrderSchema.parse({
      tenantId: "graphflow-main",
      supplierId: "sup_1",
      shippingAmount: "12.50",
      items: [
        {
          description: "Papel couche 300g",
          quantity: "10",
          unitCost: "42.90",
        },
      ],
    });

    assert.equal(parsed.shippingAmount, 12.5);
    assert.equal(parsed.items[0]?.quantity, 10);
  });

  it("requires payment amount and a supported fiscal document type", () => {
    const payment = createPaymentTransactionSchema.parse({
      tenantId: "graphflow-main",
      orderId: "ord_1",
      direction: "incoming",
      method: "PIX",
      amount: "100.50",
      status: "PAID",
    });

    assert.equal(payment.amount, 100.5);
    assert.equal(payment.feeAmount, 0);

    const fiscal = createFiscalDocumentSchema.parse({
      tenantId: "graphflow-main",
      orderId: "ord_1",
      type: "NFE",
    });

    assert.equal(fiscal.environment, "HOMOLOGATION");
    assert.equal(fiscal.operation, "SALE");
  });

  it("rejects quality inspections with rejected quantity above checked quantity", () => {
    const result = createQualityInspectionSchema.safeParse({
      tenantId: "graphflow-main",
      orderItemId: "itm_1",
      status: "REWORK",
      checkedQty: 10,
      rejectedQty: 11,
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.issues.some((issue) => issue.path.join(".") === "rejectedQty"));
  });
});
