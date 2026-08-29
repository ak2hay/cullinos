import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { cullinosTheme, formatOrderNumber } from "@cullinos/ui";
const DEMO_KOTS = [
    { id: "1", kotNumber: "K0001", items: ["2x Butter Chicken", "1x Naan"], status: "pending", time: "2 min" },
    { id: "2", kotNumber: "K0002", items: ["1x Biryani", "2x Lassi"], status: "preparing", time: "8 min" },
];
export default function App() {
    const [kots, setKots] = useState(DEMO_KOTS);
    useEffect(() => {
        const interval = setInterval(() => {
            setKots((prev) => prev.map((k) => k.status === "pending" && Math.random() > 0.7
                ? { ...k, status: "preparing" } : k));
        }, 5000);
        return () => clearInterval(interval);
    }, []);
    const bump = (id) => setKots((prev) => prev.map((k) => k.id === id ? { ...k, status: "ready" } : k));
    const s = { bg: cullinosTheme.colors.charcoal, card: cullinosTheme.colors.charcoalLight, border: cullinosTheme.colors.border, amber: cullinosTheme.colors.amber };
    return (_jsxs("div", { style: { minHeight: "100vh", background: s.bg, color: "#fff", fontFamily: cullinosTheme.fonts.sans, padding: "1rem" }, children: [_jsx("h1", { style: { color: s.amber, marginBottom: "1rem" }, children: "Cullinos KDS" }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }, children: kots.filter((k) => k.status !== "ready").map((kot) => (_jsxs("div", { style: {
                        background: s.card, border: `2px solid ${kot.status === "preparing" ? s.amber : s.border}`,
                        borderRadius: "12px", padding: "1rem",
                    }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }, children: [_jsx("span", { style: { fontFamily: cullinosTheme.fonts.mono, color: s.amber, fontWeight: 700 }, children: formatOrderNumber(kot.kotNumber.replace("K", "")) }), _jsx("span", { style: { color: cullinosTheme.colors.muted, fontSize: "0.875rem" }, children: kot.time })] }), kot.items.map((item, i) => _jsx("div", { style: { marginBottom: "0.25rem" }, children: item }, i)), _jsx("button", { onClick: () => bump(kot.id), style: {
                                marginTop: "1rem", width: "100%", padding: "0.75rem", background: s.amber,
                                border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", color: s.bg,
                            }, children: "Mark Ready" })] }, kot.id))) })] }));
}
