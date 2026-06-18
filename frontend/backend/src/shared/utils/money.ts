export type PricedItem = {
  quantity: number;
  unitPrice: number;
  discount?: number;
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineTotal(item: PricedItem): number {
  return roundMoney(item.quantity * item.unitPrice - (item.discount ?? 0));
}

export function subtotal(items: PricedItem[]): number {
  return roundMoney(items.reduce((sum, item) => sum + lineTotal(item), 0));
}
