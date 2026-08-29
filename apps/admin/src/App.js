import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { cullinosTheme } from "@cullinos/ui";
const STEPS = ["Business Info", "Menu Setup", "Tables", "Tax & GST", "Staff", "Done"];
export default function App() {
    const [step, setStep] = useState(0);
    const s = { bg: cullinosTheme.colors.charcoal, card: cullinosTheme.colors.charcoalLight, border: cullinosTheme.colors.border, amber: cullinosTheme.colors.amber };
    return (_jsxs("div", { style: { minHeight: "100vh", background: s.bg, color: "#fff", fontFamily: cullinosTheme.fonts.sans, padding: "2rem" }, children: [_jsx("h1", { style: { color: s.amber, marginBottom: "0.5rem" }, children: "Cullinos Admin" }), _jsx("p", { style: { color: cullinosTheme.colors.muted, marginBottom: "2rem" }, children: "Onboarding Wizard" }), _jsx("div", { style: { display: "flex", gap: "0.5rem", marginBottom: "2rem" }, children: STEPS.map((label, i) => (_jsx("div", { style: {
                        padding: "0.5rem 1rem", borderRadius: "20px", fontSize: "0.875rem",
                        background: i === step ? s.amber : s.card,
                        color: i === step ? s.bg : cullinosTheme.colors.muted,
                        border: `1px solid ${s.border}`,
                    }, children: label }, label))) }), _jsxs("div", { style: { background: s.card, border: `1px solid ${s.border}`, borderRadius: "12px", padding: "2rem", maxWidth: "600px" }, children: [_jsx("h2", { style: { marginTop: 0 }, children: STEPS[step] }), step === 0 && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "0.75rem" }, children: [_jsx("input", { placeholder: "Restaurant Name", style: { padding: "0.75rem", borderRadius: "8px", border: `1px solid ${s.border}`, background: s.bg, color: "#fff" } }), _jsx("input", { placeholder: "GSTIN", style: { padding: "0.75rem", borderRadius: "8px", border: `1px solid ${s.border}`, background: s.bg, color: "#fff" } })] })), step === 3 && _jsx("p", { children: "Configure CGST/SGST at 2.5% each for 5% GST on food items." }), step === 5 && _jsx("p", { style: { color: s.amber }, children: "Your restaurant is ready! Open POS to start taking orders." }), _jsxs("div", { style: { display: "flex", gap: "1rem", marginTop: "1.5rem" }, children: [step > 0 && _jsx("button", { onClick: () => setStep(step - 1), style: { padding: "0.75rem 1.5rem", borderRadius: "8px", border: `1px solid ${s.border}`, background: "transparent", color: "#fff", cursor: "pointer" }, children: "Back" }), step < STEPS.length - 1 && _jsx("button", { onClick: () => setStep(step + 1), style: { padding: "0.75rem 1.5rem", borderRadius: "8px", border: "none", background: s.amber, color: s.bg, fontWeight: 600, cursor: "pointer" }, children: "Continue" })] })] })] }));
}
