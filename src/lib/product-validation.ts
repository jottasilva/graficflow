import type { ProductFiscalData } from "./graphflow-data";

export type ProductDraft = {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  sector: string;
  description: string;
  commercialDescription: string;
  complementaryDescription: string;
  gtin: string;
  brand: string;
  thumbnailUrl: string;
  price: number;
  costPrice: number;
  markupPercent: number;
  minSalePrice: number;
  priceTable: string;
  minOrderQty: number;
  minFractionQty: number;
  allowsFractions: boolean;
  stockItem: string;
  stockQty: number;
  stockMin: number;
  stockUnit: string;
  commercialUnit: string;
  conversionFactor: string;
  netWeightKg: string;
  grossWeightKg: string;
  packageDimensionsCm: string;
  storageLocation: string;
  tracksBatch: boolean;
  fiscal: ProductFiscalData;
  skipFiscalData: boolean;
  isResale: boolean;
  internalNotes: string;
  saleBlocked: boolean;
  availableColorsText: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  sector: string;
  description: string;
  commercialDescription: string;
  complementaryDescription: string;
  gtin: string;
  brand: string;
  thumbnailUrl: string;
  availableColors: string[];
  price: number;
  costPrice: number;
  markupPercent: number;
  minSalePrice: number;
  priceTable: string;
  minOrderQty: number;
  minFractionQty: number;
  allowsFractions: boolean;
  stockItem: string;
  stockQty: number;
  stockMin: number;
  stockUnit: string;
  commercialUnit: string;
  conversionFactor: string;
  netWeightKg: string;
  grossWeightKg: string;
  packageDimensionsCm: string;
  storageLocation: string;
  tracksBatch: boolean;
  fiscal?: ProductFiscalData;
  skipFiscalData: boolean;
  isResale: boolean;
  internalNotes: string;
  leadTime: string;
  active: boolean;
  saleBlocked: boolean;
};

export const NFE_UNITS = new Set(["UN", "PC", "KG", "G", "CX", "PCT", "L", "ML", "M", "M2", "M3", "T"]);

export function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeGtin(value: string): string {
  const trimmed = value.trim().toUpperCase();
  return trimmed || "SEM GTIN";
}

export function parseAvailableColors(value: string): string[] {
  return value
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

export type ValidationResult = {
  missing: string[];
  invalid: string[];
  alerts: string[];
  ready: boolean;
};

export function validateProductFiscalDraft(draft: ProductDraft): ValidationResult {
  const missing: string[] = [];
  const invalid: string[] = [];
  const alerts: string[] = [];
  const fiscal = draft.fiscal;

  const requiredFields: Array<[string, string | number]> = [
    ["Codigo interno / SKU", draft.sku],
    ["Descricao comercial", draft.commercialDescription],
    ["GTIN/EAN", draft.gtin],
    ...(draft.skipFiscalData
      ? []
      : ([
          ["NCM", fiscal.ncm],
          ["Origem da mercadoria", fiscal.origin],
          ["CFOP padrao saida", fiscal.cfop],
          ["CST / CSOSN ICMS", fiscal.icmsCstCsosn],
          ["CST PIS", fiscal.pisCst],
          ["CST COFINS", fiscal.cofinsCst],
          ["Aliquota ICMS", fiscal.icmsRate],
          ["Aliquota PIS", fiscal.pisRate],
          ["Aliquota COFINS", fiscal.cofinsRate],
        ] as Array<[string, string | number]>)),
    ["Unidade comercial", draft.commercialUnit],
    ["Unidade de estoque", draft.stockUnit],
    ["Preco de venda", draft.price],
    ["Preco de custo", draft.costPrice],
    ["Estoque atual", draft.stockQty],
    ["Estoque minimo", draft.stockMin],
  ];

  requiredFields.forEach(([label, value]) => {
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0) missing.push(label);
      return;
    }
    if (!String(value ?? "").trim()) missing.push(label);
  });

  if (normalizeSku(draft.sku).length > 60) invalid.push("SKU deve ter no maximo 60 caracteres.");
  if (draft.commercialDescription.trim().length > 120)
    invalid.push("Descricao comercial deve ter no maximo 120 caracteres.");
  if (!/^(SEM GTIN|\d{8}|\d{12}|\d{13}|\d{14})$/.test(normalizeGtin(draft.gtin))) {
    invalid.push("GTIN/EAN deve ter 8, 12, 13 ou 14 digitos, ou SEM GTIN.");
  }

  if (!draft.skipFiscalData) {
    if (!/^\d{8}$/.test(fiscal.ncm.trim())) invalid.push("NCM deve conter exatamente 8 digitos numericos.");
    if (!/^[567]\d{3}$/.test(fiscal.cfop.trim()))
      invalid.push("CFOP deve ter 4 digitos e iniciar com 5, 6 ou 7.");
    if (!/^[0-8]$/.test(fiscal.origin.trim()))
      invalid.push("Origem da mercadoria deve ser um codigo de 0 a 8.");

    [
      ["Aliquota ICMS", fiscal.icmsRate],
      ["Aliquota PIS", fiscal.pisRate],
      ["Aliquota COFINS", fiscal.cofinsRate],
      ["Aliquota IPI", fiscal.ipiRate],
    ].forEach(([label, value]) => {
      const raw = String(value).trim();
      if (raw && !/^\d+(\.\d+)?$/.test(raw))
        invalid.push(`${label} deve ser numerica e usar ponto decimal.`);
    });
  }

  [draft.commercialUnit, draft.stockUnit].forEach((unit) => {
    if (unit && !NFE_UNITS.has(unit.trim().toUpperCase())) {
      invalid.push(`Unidade ${unit} nao esta na lista reconhecida para NF-e.`);
    }
  });

  [
    ["Peso liquido", draft.netWeightKg],
    ["Peso bruto", draft.grossWeightKg],
  ].forEach(([label, value]) => {
    const raw = String(value).trim();
    if (raw.includes(",")) invalid.push(`${label} deve usar ponto como separador decimal.`);
    if (raw && !/^\d+(\.\d{1,3})?$/.test(raw)) invalid.push(`${label} deve ser numerico, exemplo 0.500.`);
  });

  if (draft.skipFiscalData) alerts.push("Dados fiscais desativados para este cadastro.");
  if (!draft.skipFiscalData && !fiscal.cest.trim()) alerts.push("CEST vazio: preencha se houver ICMS-ST.");
  if (!draft.netWeightKg.trim()) alerts.push("Peso liquido vazio: recomendado para NF-e com frete.");
  if (!draft.grossWeightKg.trim()) alerts.push("Peso bruto vazio: recomendado para cotacao e frete.");
  if (!draft.storageLocation.trim()) alerts.push("Local de armazenagem vazio.");

  return { missing, invalid, alerts, ready: missing.length === 0 && invalid.length === 0 };
}

export function productFromDraft(draft: ProductDraft, id: string): Product {
  return {
    id,
    sku: normalizeSku(draft.sku) || id,
    name: draft.name.trim(),
    category: draft.category.trim() || "Geral",
    subcategory: draft.subcategory.trim(),
    sector: draft.sector,
    description: draft.description.trim(),
    commercialDescription: draft.commercialDescription.trim() || draft.name.trim(),
    complementaryDescription: draft.complementaryDescription.trim(),
    gtin: normalizeGtin(draft.gtin),
    brand: draft.brand.trim(),
    thumbnailUrl: draft.thumbnailUrl,
    availableColors: parseAvailableColors(draft.availableColorsText),
    price: draft.price,
    costPrice: draft.costPrice,
    markupPercent: draft.markupPercent,
    minSalePrice: draft.minSalePrice,
    priceTable: draft.priceTable.trim(),
    minOrderQty: draft.minOrderQty,
    minFractionQty: draft.minFractionQty,
    allowsFractions: draft.allowsFractions,
    stockItem: draft.stockItem,
    stockQty: draft.stockQty,
    stockMin: draft.stockMin,
    stockUnit: draft.stockUnit.trim().toUpperCase(),
    commercialUnit: draft.commercialUnit.trim().toUpperCase(),
    conversionFactor: draft.conversionFactor.trim(),
    netWeightKg: draft.netWeightKg.trim(),
    grossWeightKg: draft.grossWeightKg.trim(),
    packageDimensionsCm: draft.packageDimensionsCm.trim(),
    storageLocation: draft.storageLocation.trim(),
    tracksBatch: draft.tracksBatch,
    fiscal: draft.skipFiscalData ? undefined : { ...draft.fiscal },
    skipFiscalData: draft.skipFiscalData,
    isResale: draft.isResale,
    internalNotes: draft.internalNotes.trim(),
    leadTime: "2 dias",
    active: !draft.saleBlocked,
    saleBlocked: draft.saleBlocked,
  };
}
