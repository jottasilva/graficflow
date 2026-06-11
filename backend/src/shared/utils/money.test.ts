import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineTotal, roundMoney, subtotal } from "./money.js";

describe("money utilities", () => {
  it("rounds currency values to two decimal places", () => {
    assert.equal(roundMoney(10.005), 10.01);
    assert.equal(roundMoney(4.334), 4.33);
  });

  it("calculates line totals with discounts", () => {
    assert.equal(lineTotal({ quantity: 3, unitPrice: 19.9, discount: 4.7 }), 55);
  });

  it("calculates subtotal from rounded line totals", () => {
    assert.equal(
      subtotal([
        { quantity: 2, unitPrice: 10.255 },
        { quantity: 1, unitPrice: 4.335, discount: 0.1 },
      ]),
      24.75,
    );
  });
});
