import { useEffect, useState } from "react";
import { cullinosTheme, formatOrderNumber } from "@cullinos/ui";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

type PickupOrder = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string | null;
};

type KitchenKot = {
  id: string;
  kotNumber: string;
  status: string;
  orderNumber: string;
  customerName: string | null;
  items: Array<{ id: string; name: string; quantity: number; status: string }>;
};

type DisplayData = {
  operatingMode: string;
  kitchen: KitchenKot[];
  pickupQueue: PickupOrder[];
};

export default function App() {
  const outletId = new URLSearchParams(window.location.search).get("outletId") ?? "";
  const mode = new URLSearchParams(window.location.search).get("mode") ?? "kitchen";
  const [data, setData] = useState<DisplayData | null>(null);

  useEffect(() => {
    if (!outletId) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/kitchen/outlets/${outletId}/display`);
        if (res.ok) setData(await res.json());
      } catch {
        /* offline demo */
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [outletId]);

  const s = {
    bg: cullinosTheme.colors.charcoal,
    card: cullinosTheme.colors.charcoalLight,
    border: cullinosTheme.colors.border,
    amber: cullinosTheme.colors.amber,
  };

  if (!outletId) {
    return (
      <div style={{ minHeight: "100vh", background: s.bg, color: "#fff", padding: "2rem" }}>
        <h1 style={{ color: s.amber }}>Cullinos KDS</h1>
        <p>Add ?outletId=YOUR_OUTLET_ID to the URL</p>
        <p style={{ marginTop: "1rem", color: cullinosTheme.colors.muted }}>
          Pickup display: add &mode=pickup
        </p>
      </div>
    );
  }

  if (mode === "pickup") {
    const queue = data?.pickupQueue ?? [];
    const ready = queue.filter((o) => o.status === "ready");
    const preparing = queue.filter((o) => o.status !== "ready");

    return (
      <div style={{ minHeight: "100vh", background: s.bg, color: "#fff", fontFamily: cullinosTheme.fonts.sans, padding: "1.5rem" }}>
        <h1 style={{ color: s.amber, marginBottom: "1.5rem", fontSize: "2rem" }}>Order Pickup</h1>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          <section>
            <h2 style={{ color: cullinosTheme.colors.muted, marginBottom: "1rem" }}>Preparing</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {preparing.map((o) => (
                <div key={o.id} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: "1rem" }}>
                  <span style={{ fontFamily: cullinosTheme.fonts.mono, fontSize: "1.5rem", fontWeight: 700 }}>
                    #{formatOrderNumber(o.orderNumber)}
                  </span>
                  {o.customerName ? <span style={{ marginLeft: "1rem", color: cullinosTheme.colors.muted }}>{o.customerName}</span> : null}
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 style={{ color: s.amber, marginBottom: "1rem" }}>Ready for pickup</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {ready.map((o) => (
                <div key={o.id} style={{ background: s.amber, color: s.bg, borderRadius: 12, padding: "1.25rem", fontWeight: 700 }}>
                  <span style={{ fontFamily: cullinosTheme.fonts.mono, fontSize: "2rem" }}>
                    #{formatOrderNumber(o.orderNumber)}
                  </span>
                  {o.customerName ? <div style={{ marginTop: "0.25rem", fontSize: "1rem" }}>{o.customerName}</div> : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const kots = data?.kitchen ?? [];

  return (
    <div style={{ minHeight: "100vh", background: s.bg, color: "#fff", fontFamily: cullinosTheme.fonts.sans, padding: "1rem" }}>
      <h1 style={{ color: s.amber, marginBottom: "1rem" }}>Cullinos KDS</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        {kots.map((kot) => (
          <div key={kot.id} style={{
            background: s.card, border: `2px solid ${kot.status === "preparing" ? s.amber : s.border}`,
            borderRadius: "12px", padding: "1rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontFamily: cullinosTheme.fonts.mono, color: s.amber, fontWeight: 700 }}>
                {kot.kotNumber}
              </span>
              <span style={{ color: cullinosTheme.colors.muted, fontSize: "0.875rem" }}>
                #{formatOrderNumber(kot.orderNumber)}
              </span>
            </div>
            {kot.customerName ? <div style={{ marginBottom: "0.5rem", fontSize: "0.875rem" }}>{kot.customerName}</div> : null}
            {kot.items.map((item) => (
              <div key={item.id} style={{ marginBottom: "0.25rem" }}>{item.quantity}x {item.name}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
