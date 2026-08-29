import { useState } from "react";
import { cullinosTheme, formatCurrency, formatOrderNumber } from "@cullinos/ui";

const MENU = [
  { id: "1", name: "Butter Chicken", price: 280, veg: false },
  { id: "2", name: "Paneer Tikka", price: 220, veg: true },
  { id: "3", name: "Dal Makhani", price: 180, veg: true },
  { id: "4", name: "Naan", price: 40, veg: true },
  { id: "5", name: "Lassi", price: 60, veg: true },
  { id: "6", name: "Biryani", price: 320, veg: false },
];

type CartItem = { id: string; name: string; price: number; qty: number };

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNum, setOrderNum] = useState(1);

  const addItem = (item: typeof MENU[0]) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const tax = total * 0.05;

  const submitOrder = async () => {
    if (!cart.length) return;
    try {
      await fetch("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer demo" },
        body: JSON.stringify({
          outletId: "demo",
          items: cart.map((c) => ({ name: c.name, quantity: c.qty, unitPrice: c.price })),
        }),
      });
    } catch { /* offline — gateway would queue */ }
    setCart([]);
    setOrderNum((n) => n + 1);
  };

  const s = {
    bg: cullinosTheme.colors.charcoal,
    card: cullinosTheme.colors.charcoalLight,
    border: cullinosTheme.colors.border,
    amber: cullinosTheme.colors.amber,
    muted: cullinosTheme.colors.muted,
  };

  return (
    <div style={{ minHeight: "100vh", background: s.bg, color: "#fff", fontFamily: cullinosTheme.fonts.sans, display: "flex" }}>
      <div style={{ flex: 1, padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ color: s.amber, margin: 0 }}>Cullinos POS</h1>
          <span style={{ fontFamily: cullinosTheme.fonts.mono, color: s.amber }}>#{formatOrderNumber(orderNum)}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {MENU.map((item) => (
            <button key={item.id} onClick={() => addItem(item)} style={{
              background: s.card, border: `1px solid ${s.border}`, borderRadius: "12px",
              padding: "1rem", color: "#fff", cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div style={{ color: s.amber, marginTop: "0.25rem" }}>{formatCurrency(item.price)}</div>
              <div style={{ color: s.muted, fontSize: "0.75rem" }}>{item.veg ? "Veg" : "Non-veg"}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: "320px", background: s.card, borderLeft: `1px solid ${s.border}`, padding: "1rem" }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Current Order</h2>
        {cart.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            <span>{c.qty}x {c.name}</span>
            <span>{formatCurrency(c.price * c.qty)}</span>
          </div>
        ))}
        <hr style={{ borderColor: s.border, margin: "1rem 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", color: s.muted }}><span>Tax (5%)</span><span>{formatCurrency(tax)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.1rem", marginTop: "0.5rem" }}>
          <span>Total</span><span style={{ color: s.amber }}>{formatCurrency(total + tax)}</span>
        </div>
        <button onClick={submitOrder} style={{
          width: "100%", marginTop: "1.5rem", padding: "1rem", background: s.amber,
          border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer", color: s.bg,
        }}>Send to Kitchen</button>
      </div>
    </div>
  );
}
