import { useState } from "react";
import { cullinosTheme } from "@cullinos/ui";

const STEPS = ["Business Info", "Menu Setup", "Tables", "Tax & GST", "Staff", "Done"];

export default function App() {
  const [step, setStep] = useState(0);
  const s = { bg: cullinosTheme.colors.charcoal, card: cullinosTheme.colors.charcoalLight, border: cullinosTheme.colors.border, amber: cullinosTheme.colors.amber };

  return (
    <div style={{ minHeight: "100vh", background: s.bg, color: "#fff", fontFamily: cullinosTheme.fonts.sans, padding: "2rem" }}>
      <h1 style={{ color: s.amber, marginBottom: "0.5rem" }}>Cullinos Admin</h1>
      <p style={{ color: cullinosTheme.colors.muted, marginBottom: "2rem" }}>Onboarding Wizard</p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{
            padding: "0.5rem 1rem", borderRadius: "20px", fontSize: "0.875rem",
            background: i === step ? s.amber : s.card,
            color: i === step ? s.bg : cullinosTheme.colors.muted,
            border: `1px solid ${s.border}`,
          }}>{label}</div>
        ))}
      </div>
      <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: "12px", padding: "2rem", maxWidth: "600px" }}>
        <h2 style={{ marginTop: 0 }}>{STEPS[step]}</h2>
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input placeholder="Restaurant Name" style={{ padding: "0.75rem", borderRadius: "8px", border: `1px solid ${s.border}`, background: s.bg, color: "#fff" }} />
            <input placeholder="GSTIN" style={{ padding: "0.75rem", borderRadius: "8px", border: `1px solid ${s.border}`, background: s.bg, color: "#fff" }} />
          </div>
        )}
        {step === 3 && <p>Configure CGST/SGST at 2.5% each for 5% GST on food items.</p>}
        {step === 5 && <p style={{ color: s.amber }}>Your restaurant is ready! Open POS to start taking orders.</p>}
        <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
          {step > 0 && <button onClick={() => setStep(step - 1)} style={{ padding: "0.75rem 1.5rem", borderRadius: "8px", border: `1px solid ${s.border}`, background: "transparent", color: "#fff", cursor: "pointer" }}>Back</button>}
          {step < STEPS.length - 1 && <button onClick={() => setStep(step + 1)} style={{ padding: "0.75rem 1.5rem", borderRadius: "8px", border: "none", background: s.amber, color: s.bg, fontWeight: 600, cursor: "pointer" }}>Continue</button>}
        </div>
      </div>
    </div>
  );
}
