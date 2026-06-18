"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CartItem } from "@/lib/cart-store";
import { formatPrice, getCartCount, getCartTotal, loadCart, saveCart } from "@/lib/cart-store";

export function CartSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(loadCart());
    const handler = () => setItems(loadCart());
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, []);

  function updateQty(id: string, delta: number) {
    const next = items.map((item) =>
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
    );
    setItems(next);
    saveCart(next);
  }

  function removeItem(id: string) {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    saveCart(next);
  }

  const total = getCartTotal(items);
  const count = getCartCount(items);

  return (
    <>
      {open ? <div className="cart-overlay" onClick={onClose} /> : null}
      <aside className={`cart-sidebar ${open ? "cart-sidebar-open" : ""}`}>
        <div className="cart-sidebar-head">
          <h2>
            <ShoppingCart size={20} />
            Carrinho
          </h2>
          <button className="cart-close" type="button" onClick={onClose} aria-label="Fechar carrinho">
            <X size={22} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cart-empty">
            <ShoppingCart size={48} />
            <p>Seu carrinho está vazio</p>
            <Link href="/produtos" className="cart-browse" onClick={onClose}>
              Ver produtos
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div className="cart-item-image">
                    <Image src={item.imageUrl} alt={item.title} width={64} height={64} />
                  </div>
                  <div className="cart-item-info">
                    <strong>{item.title}</strong>
                    <span className="cart-item-price">{item.price}</span>
                  </div>
                  <div className="cart-item-qty">
                    <button type="button" onClick={() => updateQty(item.id, -1)} disabled={item.quantity <= 1}>
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQty(item.id, 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    className="cart-item-remove"
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remover ${item.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-footer">
              <div className="cart-total">
                <span>{count} item(ns)</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              <p className="cart-whatsapp-hint">
                O pedido será enviado pelo WhatsApp para finalização.
              </p>
              <button 
                className="cart-checkout-btn" 
                onClick={() => {
                  const phone = "5511999999999"; // Replace with your actual WhatsApp number or load from config
                  let text = `Olá! Gostaria de fechar o seguinte pedido:\n\n`;
                  items.forEach((item) => {
                    text += `- ${item.quantity}x ${item.title} (${item.price})\n`;
                  });
                  text += `\n*Total: ${formatPrice(total)}*\n\nAguardo as instruções para envio das artes e pagamento.`;
                  
                  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
                  window.open(url, "_blank");
                }}
              >
                Fechar Pedido no WhatsApp
              </button>
            </div>
          </>
        )}
      </aside>

      <style>{`
        .cart-overlay {
          position: fixed;
          inset: 0;
          z-index: 998;
          background: rgba(0,0,0,0.4);
        }
        .cart-sidebar {
          position: fixed;
          top: 0;
          right: 0;
          z-index: 999;
          width: min(420px, 100vw);
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #fff;
          box-shadow: -4px 0 24px rgba(0,0,0,0.12);
          transform: translateX(100%);
          transition: transform 260ms ease;
        }
        .cart-sidebar-open {
          transform: translateX(0);
        }
        .cart-sidebar-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 20px 16px;
          border-bottom: 1px solid #eef0f6;
        }
        .cart-sidebar-head h2 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-size: 18px;
          font-weight: 620;
        }
        .cart-close {
          display: grid;
          width: 38px;
          height: 38px;
          place-items: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          color: #111827;
        }
        .cart-close:hover {
          background: #f3f4f6;
        }
        .cart-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 20px;
          color: #9ca3af;
          text-align: center;
        }
        .cart-empty p {
          margin: 0;
          font-size: 15px;
        }
        .cart-browse {
          display: inline-flex;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          padding: 0 20px;
          border-radius: 8px;
          background: linear-gradient(135deg, #5b45ff, #6d37ff);
          color: #fff;
          font-size: 13px;
          font-weight: 520;
          text-decoration: none;
        }
        .cart-items {
          flex: 1;
          overflow-y: auto;
          padding: 12px 20px;
        }
        .cart-item {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .cart-item-image {
          width: 64px;
          height: 64px;
          flex: 0 0 auto;
          border-radius: 8px;
          overflow: hidden;
          background: #f9fafb;
        }
        .cart-item-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cart-item-info {
          flex: 1;
          min-width: 0;
        }
        .cart-item-info strong {
          display: block;
          font-size: 13px;
          line-height: 1.2;
        }
        .cart-item-price {
          display: block;
          margin-top: 4px;
          color: #5b45ff;
          font-size: 14px;
          font-weight: 620;
        }
        .cart-item-qty {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 2px;
        }
        .cart-item-qty button {
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border: 0;
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
          color: #374151;
        }
        .cart-item-qty button:hover {
          background: #f3f4f6;
        }
        .cart-item-qty button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .cart-item-qty span {
          width: 24px;
          text-align: center;
          font-size: 13px;
          font-weight: 520;
        }
        .cart-item-remove {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border: 0;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          color: #ef4444;
        }
        .cart-item-remove:hover {
          background: #fef2f2;
        }
        .cart-footer {
          border-top: 1px solid #eef0f6;
          padding: 16px 20px 20px;
        }
        .cart-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .cart-total span {
          color: #6b7280;
          font-size: 13px;
        }
        .cart-total strong {
          font-size: 20px;
          font-weight: 720;
          color: #111827;
        }
        .cart-whatsapp-hint {
          margin: 0;
          color: #9ca3af;
          font-size: 12px;
          line-height: 1.4;
          margin-bottom: 12px;
        }
        .cart-checkout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          border-radius: 8px;
          background: #25d366;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }
        .cart-checkout-btn:hover {
          background: #128c7e;
        }
      `}</style>
    </>
  );
}
