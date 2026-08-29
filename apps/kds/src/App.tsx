import { useState, useEffect } from "react";
import { cullinosTheme, formatOrderNumber } from "@cullinos/ui";

type KOT = { id: string; kotNumber: string; items: string[]; status: string; time: string };

const DEMO_KOTS: KOT[] = [
  { id: "1", kotNumber: "K0001", items: ["2x Butter Chicken", "1x Naan"], status: "pending", time: "2 min" },
  { id: "2", kotNumber: "K0002", items: ["1x Biryani", "2x Lassi"], status: "preparing", time: "8 min" },
];

export default function App() {
  const [kots, setKots] = useState<KOT[]>(DEMO_KOTS);

  useEffect(() => {
    const interval = setInterval(() => {
      setKots((prev) => prev.map((k) => k.status === "pending" && Math.random() > 0.7
        ? { ...k, status: "preparing" } : k));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const bump = (id: string) => setKots((prev) => prev.map((k) => k.id === id ? { ...k, status: "ready" } : k));

  const s = { bg: cullinosTheme.colors.charcoal, card: cullinosTheme.colors.charcoalLight, border: cullinosTheme.colors.border, amber: cullinosTheme.colors.amber };

  return (
    <div style={{ minHeight: "100vh", background: s.bg, color: "#fff", fontFamily: cullinosTheme.fonts.sans, padding: "1rem" }}>
      <h1 style={{ color: s.amber, marginBottom: "1rem" }}>Cullinos KDS</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        {kots.filter((k) => k.status !== "ready").map((kot) => (
          <div key={kot.id} style={{
            background: s.card, border: `2px solid ${kot.status === "preparing" ? s.amber : s.border}`,
            borderRadius: "12px", padding: "1rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontFamily: cullinosTheme.fonts.mono, color: s.amber, fontWeight: 700 }}>
                {formatOrderNumber(kot.kotNumber.replace("K", ""))}
              </span>
              <span style={{ color: cullinosTheme.colors.muted, fontSize: "0.875rem" }}>{kot.time}</span>
            </div>
            {kot.items.map((item, i) => <div key={i} style={{ marginBottom: "0.25rem" }}>{item}</div>)}
            <button onClick={() => bump(kot.id)} style={{
              marginTop: "1rem", width: "100%", padding: "0.75rem", background: s.amber,
              border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", color: s.bg,
            }}>Mark Ready</button>
          </div>
        ))}
      </div>
    </div>
  );
}
