import { describe, it, expect } from "vitest";
import {
  normalizeSku,
  normalizeGtin,
  parseAvailableColors,
  validateProductFiscalDraft,
  productFromDraft,
  NFE_UNITS,
  type ProductDraft,
} from "../product-validation";

function makeDraft(overrides: Partial<ProductDraft> = {}): ProductDraft {
  return {
    sku: "SKU-001",
    name: "Produto Teste",
    category: "Papelaria",
    subcategory: "",
    sector: "Impressão",
    description: "",
    commercialDescription: "Produto teste descricao",
    complementaryDescription: "",
    gtin: "SEM GTIN",
    brand: "",
    thumbnailUrl: "",
    price: 25.5,
    costPrice: 12.0,
    markupPercent: 112,
    minSalePrice: 20.0,
    priceTable: "",
    minOrderQty: 50,
    minFractionQty: 50,
    allowsFractions: true,
    stockItem: "Vinil Branco",
    stockQty: 100,
    stockMin: 10,
    stockUnit: "UN",
    commercialUnit: "UN",
    conversionFactor: "",
    netWeightKg: "0.500",
    grossWeightKg: "0.650",
    packageDimensionsCm: "30x20x5",
    storageLocation: "Galpão A",
    tracksBatch: false,
    fiscal: {
      ncm: "48191000",
      cest: "",
      origin: "0",
      cfop: "5102",
      icmsCstCsosn: "102",
      pisCst: "01",
      cofinsCst: "01",
      ipiCst: "",
      icmsRate: "18",
      pisRate: "1.65",
      cofinsRate: "7.6",
      ipiRate: "",
      additionalInfo: "",
    },
    skipFiscalData: false,
    isResale: false,
    internalNotes: "",
    saleBlocked: false,
    availableColorsText: "Azul, Verde, Preto, Branco",
    ...overrides,
  };
}

describe("normalizeSku", () => {
  it("trims and uppercases", () => {
    expect(normalizeSku("  abc-123  ")).toBe("ABC-123");
  });

  it("returns empty for empty string", () => {
    expect(normalizeSku("")).toBe("");
  });
});

describe("normalizeGtin", () => {
  it("returns SEM GTIN for empty", () => {
    expect(normalizeGtin("")).toBe("SEM GTIN");
  });

  it("trims and uppercases", () => {
    expect(normalizeGtin("  7891234567890  ")).toBe("7891234567890");
  });

  it("returns SEM GTIN for whitespace", () => {
    expect(normalizeGtin("   ")).toBe("SEM GTIN");
  });
});

describe("parseAvailableColors", () => {
  it("splits comma-separated colors", () => {
    expect(parseAvailableColors("Azul, Verde, Preto")).toEqual(["Azul", "Verde", "Preto"]);
  });

  it("trims whitespace", () => {
    expect(parseAvailableColors("  Azul ,  Verde  ")).toEqual(["Azul", "Verde"]);
  });

  it("filters empty entries", () => {
    expect(parseAvailableColors("Azul,, Verde,")).toEqual(["Azul", "Verde"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseAvailableColors("")).toEqual([]);
  });
});

describe("validateProductFiscalDraft", () => {
  describe("ready state", () => {
    it("returns ready=true for a complete valid draft", () => {
      const result = validateProductFiscalDraft(makeDraft());
      expect(result.ready).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
    });

    it("returns ready=false when name is empty", () => {
      const result = validateProductFiscalDraft(makeDraft({ name: "" }));
      expect(result.ready).toBe(false);
    });

    it("returns ready=false when price is 0", () => {
      const result = validateProductFiscalDraft(makeDraft({ price: 0 }));
      expect(result.ready).toBe(false);
      expect(result.missing).toContain("Preco de venda");
    });

    it("returns ready=false when price is negative", () => {
      const result = validateProductFiscalDraft(makeDraft({ price: -5 }));
      expect(result.ready).toBe(false);
      expect(result.missing).toContain("Preco de venda");
    });
  });

  describe("missing required fields", () => {
    it("detects missing SKU", () => {
      const result = validateProductFiscalDraft(makeDraft({ sku: "" }));
      expect(result.missing).toContain("Codigo interno / SKU");
    });

    it("detects missing commercial description", () => {
      const result = validateProductFiscalDraft(makeDraft({ commercialDescription: "" }));
      expect(result.missing).toContain("Descricao comercial");
    });

    it("detects missing GTIN", () => {
      const result = validateProductFiscalDraft(makeDraft({ gtin: "" }));
      expect(result.missing).toContain("GTIN/EAN");
    });

    it("detects missing commercial unit", () => {
      const result = validateProductFiscalDraft(makeDraft({ commercialUnit: "" }));
      expect(result.missing).toContain("Unidade comercial");
    });

    it("detects missing stock unit", () => {
      const result = validateProductFiscalDraft(makeDraft({ stockUnit: "" }));
      expect(result.missing).toContain("Unidade de estoque");
    });

    it("detects missing cost price", () => {
      const result = validateProductFiscalDraft(makeDraft({ costPrice: 0 }));
      expect(result.missing).toContain("Preco de custo");
    });

    it("detects missing stock quantity", () => {
      const result = validateProductFiscalDraft(makeDraft({ stockQty: -1 }));
      expect(result.missing).toContain("Estoque atual");
    });

    it("detects missing stock minimum", () => {
      const result = validateProductFiscalDraft(makeDraft({ stockMin: -1 }));
      expect(result.missing).toContain("Estoque minimo");
    });
  });

  describe("fiscal fields validation", () => {
    it("requires NCM when fiscal data is not skipped", () => {
      const draft = makeDraft();
      draft.fiscal.ncm = "";
      const result = validateProductFiscalDraft(draft);
      expect(result.missing).toContain("NCM");
    });

    it("requires CFOP when fiscal data is not skipped", () => {
      const draft = makeDraft();
      draft.fiscal.cfop = "";
      const result = validateProductFiscalDraft(draft);
      expect(result.missing).toContain("CFOP padrao saida");
    });

    it("requires ICMS CST when fiscal data is not skipped", () => {
      const draft = makeDraft();
      draft.fiscal.icmsCstCsosn = "";
      const result = validateProductFiscalDraft(draft);
      expect(result.missing).toContain("CST / CSOSN ICMS");
    });

    it("does NOT require fiscal fields when skipFiscalData=true", () => {
      const draft = makeDraft({ skipFiscalData: true });
      draft.fiscal.ncm = "";
      draft.fiscal.cfop = "";
      draft.fiscal.icmsCstCsosn = "";
      draft.fiscal.pisCst = "";
      draft.fiscal.cofinsCst = "";
      draft.fiscal.icmsRate = "";
      draft.fiscal.pisRate = "";
      draft.fiscal.cofinsRate = "";
      const result = validateProductFiscalDraft(draft);
      expect(result.missing).not.toContain("NCM");
      expect(result.missing).not.toContain("CFOP padrao saida");
      expect(result.missing).not.toContain("CST / CSOSN ICMS");
    });
  });

  describe("format validation", () => {
    it("rejects SKU longer than 60 chars", () => {
      const result = validateProductFiscalDraft(makeDraft({ sku: "A".repeat(61) }));
      expect(result.invalid.some((msg) => msg.includes("SKU"))).toBe(true);
    });

    it("rejects commercial description longer than 120 chars", () => {
      const result = validateProductFiscalDraft(makeDraft({ commercialDescription: "A".repeat(121) }));
      expect(result.invalid.some((msg) => msg.includes("Descricao comercial"))).toBe(true);
    });

    it("rejects invalid GTIN format", () => {
      const result = validateProductFiscalDraft(makeDraft({ gtin: "12345" }));
      expect(result.invalid.some((msg) => msg.includes("GTIN"))).toBe(true);
    });

    it("accepts SEM GTIN", () => {
      const result = validateProductFiscalDraft(makeDraft({ gtin: "SEM GTIN" }));
      expect(result.invalid.some((msg) => msg.includes("GTIN"))).toBe(false);
    });

    it("accepts 8-digit GTIN", () => {
      const result = validateProductFiscalDraft(makeDraft({ gtin: "12345678" }));
      expect(result.invalid.some((msg) => msg.includes("GTIN"))).toBe(false);
    });

    it("accepts 13-digit GTIN", () => {
      const result = validateProductFiscalDraft(makeDraft({ gtin: "7891234567890" }));
      expect(result.invalid.some((msg) => msg.includes("GTIN"))).toBe(false);
    });

    it("rejects NCM with wrong length", () => {
      const draft = makeDraft();
      draft.fiscal.ncm = "1234567";
      const result = validateProductFiscalDraft(draft);
      expect(result.invalid.some((msg) => msg.includes("NCM"))).toBe(true);
    });

    it("rejects NCM with non-numeric chars", () => {
      const draft = makeDraft();
      draft.fiscal.ncm = "4819100A";
      const result = validateProductFiscalDraft(draft);
      expect(result.invalid.some((msg) => msg.includes("NCM"))).toBe(true);
    });

    it("accepts valid 8-digit NCM", () => {
      const draft = makeDraft();
      draft.fiscal.ncm = "48191000";
      const result = validateProductFiscalDraft(draft);
      expect(result.invalid.some((msg) => msg.includes("NCM"))).toBe(false);
    });

    it("rejects CFOP not starting with 5/6/7", () => {
      const draft = makeDraft();
      draft.fiscal.cfop = "1102";
      const result = validateProductFiscalDraft(draft);
      expect(result.invalid.some((msg) => msg.includes("CFOP"))).toBe(true);
    });

    it("accepts valid CFOP", () => {
      const draft = makeDraft();
      draft.fiscal.cfop = "5102";
      const result = validateProductFiscalDraft(draft);
      expect(result.invalid.some((msg) => msg.includes("CFOP"))).toBe(false);
    });

    it("rejects origin outside 0-8", () => {
      const draft = makeDraft();
      draft.fiscal.origin = "9";
      const result = validateProductFiscalDraft(draft);
      expect(result.invalid.some((msg) => msg.includes("Origem"))).toBe(true);
    });

    it("rejects non-numeric ICMS rate", () => {
      const draft = makeDraft();
      draft.fiscal.icmsRate = "abc";
      const result = validateProductFiscalDraft(draft);
      expect(result.invalid.some((msg) => msg.includes("Aliquota ICMS"))).toBe(true);
    });

    it("accepts decimal ICMS rate with dot", () => {
      const draft = makeDraft();
      draft.fiscal.icmsRate = "18.00";
      const result = validateProductFiscalDraft(draft);
      expect(result.invalid.some((msg) => msg.includes("Aliquota ICMS"))).toBe(false);
    });
  });

  describe("unit validation", () => {
    it("accepts valid NFe units", () => {
      for (const unit of ["UN", "PC", "KG", "CX", "PCT"]) {
        const result = validateProductFiscalDraft(makeDraft({ commercialUnit: unit, stockUnit: unit }));
        expect(result.invalid.some((msg) => msg.includes("Unidade"))).toBe(false);
      }
    });

    it("rejects unknown unit", () => {
      const result = validateProductFiscalDraft(makeDraft({ commercialUnit: "INVALID" }));
      expect(result.invalid.some((msg) => msg.includes("Unidade"))).toBe(true);
    });

    it("case-insensitive unit check", () => {
      const result = validateProductFiscalDraft(makeDraft({ commercialUnit: "un" }));
      expect(result.invalid.some((msg) => msg.includes("Unidade"))).toBe(false);
    });
  });

  describe("weight validation", () => {
    it("rejects weight with comma decimal separator", () => {
      const result = validateProductFiscalDraft(makeDraft({ netWeightKg: "0,500" }));
      expect(result.invalid.some((msg) => msg.includes("Peso liquido"))).toBe(true);
    });

    it("accepts valid weight with dot", () => {
      const result = validateProductFiscalDraft(makeDraft({ netWeightKg: "0.500" }));
      expect(result.invalid.some((msg) => msg.includes("Peso liquido"))).toBe(false);
    });

    it("rejects non-numeric weight", () => {
      const result = validateProductFiscalDraft(makeDraft({ grossWeightKg: "abc" }));
      expect(result.invalid.some((msg) => msg.includes("Peso bruto"))).toBe(true);
    });
  });

  describe("alerts", () => {
    it("alerts when fiscal data is skipped", () => {
      const result = validateProductFiscalDraft(makeDraft({ skipFiscalData: true }));
      expect(result.alerts.some((msg) => msg.includes("desativados"))).toBe(true);
    });

    it("alerts when CEST is empty", () => {
      const draft = makeDraft();
      draft.fiscal.cest = "";
      const result = validateProductFiscalDraft(draft);
      expect(result.alerts.some((msg) => msg.includes("CEST"))).toBe(true);
    });

    it("alerts when net weight is empty", () => {
      const result = validateProductFiscalDraft(makeDraft({ netWeightKg: "" }));
      expect(result.alerts.some((msg) => msg.includes("Peso liquido"))).toBe(true);
    });

    it("alerts when gross weight is empty", () => {
      const result = validateProductFiscalDraft(makeDraft({ grossWeightKg: "" }));
      expect(result.alerts.some((msg) => msg.includes("Peso bruto"))).toBe(true);
    });

    it("alerts when storage location is empty", () => {
      const result = validateProductFiscalDraft(makeDraft({ storageLocation: "" }));
      expect(result.alerts.some((msg) => msg.includes("armazenagem"))).toBe(true);
    });
  });
});

describe("productFromDraft", () => {
  it("converts draft to product with correct id", () => {
    const draft = makeDraft();
    const product = productFromDraft(draft, "prod-123");
    expect(product.id).toBe("prod-123");
  });

  it("trims and normalizes string fields", () => {
    const draft = makeDraft({
      name: "  Produto com espacos  ",
      sku: "  sku-001  ",
      gtin: "  7891234567890  ",
      commercialUnit: "  un  ",
      stockUnit: "  un  ",
    });
    const product = productFromDraft(draft, "id-1");
    expect(product.name).toBe("Produto com espacos");
    expect(product.sku).toBe("SKU-001");
    expect(product.gtin).toBe("7891234567890");
    expect(product.commercialUnit).toBe("UN");
    expect(product.stockUnit).toBe("UN");
  });

  it("defaults category to Geral when empty", () => {
    const draft = makeDraft({ category: "" });
    const product = productFromDraft(draft, "id-1");
    expect(product.category).toBe("Geral");
  });

  it("defaults commercialDescription to name when empty", () => {
    const draft = makeDraft({ commercialDescription: "" });
    const product = productFromDraft(draft, "id-1");
    expect(product.commercialDescription).toBe(draft.name);
  });

  it("sets fiscal to undefined when skipFiscalData=true", () => {
    const draft = makeDraft({ skipFiscalData: true });
    const product = productFromDraft(draft, "id-1");
    expect(product.fiscal).toBeUndefined();
  });

  it("includes fiscal data when skipFiscalData=false", () => {
    const draft = makeDraft({ skipFiscalData: false });
    const product = productFromDraft(draft, "id-1");
    expect(product.fiscal).toBeDefined();
    expect(product.fiscal?.ncm).toBe("48191000");
  });

  it("parses available colors from text", () => {
    const draft = makeDraft({ availableColorsText: "Vermelho, Amarelo" });
    const product = productFromDraft(draft, "id-1");
    expect(product.availableColors).toEqual(["Vermelho", "Amarelo"]);
  });

  it("sets active based on saleBlocked", () => {
    expect(productFromDraft(makeDraft({ saleBlocked: false }), "id-1").active).toBe(true);
    expect(productFromDraft(makeDraft({ saleBlocked: true }), "id-1").active).toBe(false);
  });

  it("sets leadTime to 2 dias", () => {
    const product = productFromDraft(makeDraft(), "id-1");
    expect(product.leadTime).toBe("2 dias");
  });

  it("uses id as fallback SKU when sku is empty", () => {
    const draft = makeDraft({ sku: "" });
    const product = productFromDraft(draft, "fallback-id");
    expect(product.sku).toBe("FALLBACK-ID");
  });

  it("preserves numeric fields", () => {
    const draft = makeDraft({
      price: 99.99,
      costPrice: 45.5,
      markupPercent: 120,
      minSalePrice: 80,
      stockQty: 500,
      stockMin: 50,
      minOrderQty: 100,
      minFractionQty: 25,
    });
    const product = productFromDraft(draft, "id-1");
    expect(product.price).toBe(99.99);
    expect(product.costPrice).toBe(45.5);
    expect(product.markupPercent).toBe(120);
    expect(product.minSalePrice).toBe(80);
    expect(product.stockQty).toBe(500);
    expect(product.stockMin).toBe(50);
    expect(product.minOrderQty).toBe(100);
    expect(product.minFractionQty).toBe(25);
  });

  it("preserves boolean fields", () => {
    const draft = makeDraft({
      allowsFractions: true,
      tracksBatch: true,
      isResale: true,
      skipFiscalData: true,
      saleBlocked: true,
    });
    const product = productFromDraft(draft, "id-1");
    expect(product.allowsFractions).toBe(true);
    expect(product.tracksBatch).toBe(true);
    expect(product.isResale).toBe(true);
    expect(product.skipFiscalData).toBe(true);
    expect(product.saleBlocked).toBe(true);
    expect(product.active).toBe(false);
  });
});

describe("NFE_UNITS", () => {
  it("contains expected units", () => {
    expect(NFE_UNITS.has("UN")).toBe(true);
    expect(NFE_UNITS.has("PC")).toBe(true);
    expect(NFE_UNITS.has("KG")).toBe(true);
    expect(NFE_UNITS.has("CX")).toBe(true);
    expect(NFE_UNITS.has("PCT")).toBe(true);
    expect(NFE_UNITS.has("L")).toBe(true);
    expect(NFE_UNITS.has("ML")).toBe(true);
    expect(NFE_UNITS.has("M")).toBe(true);
    expect(NFE_UNITS.has("M2")).toBe(true);
    expect(NFE_UNITS.has("M3")).toBe(true);
    expect(NFE_UNITS.has("T")).toBe(true);
    expect(NFE_UNITS.has("G")).toBe(true);
  });

  it("does not contain invalid units", () => {
    expect(NFE_UNITS.has("INVALID")).toBe(false);
    expect(NFE_UNITS.has("ZZ")).toBe(false);
  });
});
