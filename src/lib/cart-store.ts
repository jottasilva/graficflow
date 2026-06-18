"use client";

export type CartItem = {
  id: string;
  title: string;
  price: string;
  imageUrl: string;
  quantity: number;
  oldPrice?: string;
  tag?: string;
};

const STORAGE_KEY = "graphflow.cart";

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: items }));
  } catch {}
}

export function parsePrice(price: string): number {
  return Number(price.replace(/[^0-9,.]/g, "").replace(",", ".")) || 0;
}

export function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function getCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + parsePrice(item.price) * item.quantity, 0);
}

export function getCartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
