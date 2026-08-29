import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export default function App() {
    const [cart, setCart] = useState([]);
    const [orderNum, setOrderNum] = useState(1);
    const addItem = (item) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.id === item.id);
            if (existing)
                return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
            return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
        });
    };
    const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const tax = total * 0.05;
    const submitOrder = async () => {
        if (!cart.length)
            return;
        try {
            await fetch("http://localhost:3000/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer demo" },
                body: JSON.stringify({
                    outletId: "demo",
                    items: cart.map((c) => ({ name: c.name, quantity: c.qty, unitPrice: c.price })),
                }),
            });
        }
        catch { /* offline — gateway would queue */ }
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
    return (_jsxs("div", { style: { minHeight: "100vh", background: s.bg, color: "#fff", fontFamily: cullinosTheme.fonts.sans, display: "flex" }, children: [_jsxs("div", { style: { flex: 1, padding: "1rem" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }, children: [_jsx("h1", { style: { color: s.amber, margin: 0 }, children: "Cullinos POS" }), _jsxs("span", { style: { fontFamily: cullinosTheme.fonts.mono, color: s.amber }, children: ["#", formatOrderNumber(orderNum)] })] }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }, children: MENU.map((item) => (_jsxs("button", { onClick: () => addItem(item), style: {
                                background: s.card, border: `1px solid ${s.border}`, borderRadius: "12px",
                                padding: "1rem", color: "#fff", cursor: "pointer", textAlign: "left",
                            }, children: [_jsx("div", { style: { fontWeight: 600 }, children: item.name }), _jsx("div", { style: { color: s.amber, marginTop: "0.25rem" }, children: formatCurrency(item.price) }), _jsx("div", { style: { color: s.muted, fontSize: "0.75rem" }, children: item.veg ? "Veg" : "Non-veg" })] }, item.id))) })] }), _jsxs("div", { style: { width: "320px", background: s.card, borderLeft: `1px solid ${s.border}`, padding: "1rem" }, children: [_jsx("h2", { style: { margin: "0 0 1rem", fontSize: "1rem" }, children: "Current Order" }), cart.map((c) => (_jsxs("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }, children: [_jsxs("span", { children: [c.qty, "x ", c.name] }), _jsx("span", { children: formatCurrency(c.price * c.qty) })] }, c.id))), _jsx("hr", { style: { borderColor: s.border, margin: "1rem 0" } }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", color: s.muted }, children: [_jsx("span", { children: "Tax (5%)" }), _jsx("span", { children: formatCurrency(tax) })] }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.1rem", marginTop: "0.5rem" }, children: [_jsx("span", { children: "Total" }), _jsx("span", { style: { color: s.amber }, children: formatCurrency(total + tax) })] }), _jsx("button", { onClick: submitOrder, style: {
                            width: "100%", marginTop: "1.5rem", padding: "1rem", background: s.amber,
                            border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer", color: s.bg,
                        }, children: "Send to Kitchen" })] })] }));
}
