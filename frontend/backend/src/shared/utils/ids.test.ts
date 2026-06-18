import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { documentNumber, isDocumentNumberConflict, randomId, randomToken } from "./ids.js";

describe("id utilities", () => {
  it("generates prefixed random ids with compact uuid payloads", () => {
    const id = randomId("ord");

    assert.match(id, /^ord_[a-f0-9]{24}$/);
  });

  it("generates url-safe random tokens", () => {
    const token = randomToken(24);

    assert.equal(token.length, 32);
    assert.match(token, /^[A-Za-z0-9_-]+$/);
  });

  it("generates document numbers with date and uppercase suffix", () => {
    const number = documentNumber("ORC");

    assert.match(number, /^ORC-\d{8}-[A-F0-9]{6}$/);
  });

  it("detects unique document number conflicts", () => {
    assert.equal(
      isDocumentNumberConflict({
        code: "23505",
        message: 'duplicate key value violates unique constraint "orders_tenantId_number_key"',
        details: 'Key ("tenantId", number)=(tenant_demo, PED-20260610-ABC123) already exists.',
      }),
      true,
    );
    assert.equal(isDocumentNumberConflict({ code: "23505", message: "duplicate key value violates unique constraint users_email_key" }), false);
    assert.equal(isDocumentNumberConflict(null), false);
  });
});
