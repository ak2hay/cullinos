import { cullinosTheme, poweredByRkyves } from "@cullinos/ui";

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: cullinosTheme.colors.charcoal, color: cullinosTheme.colors.white, fontFamily: cullinosTheme.fonts.sans, padding: '2rem' }}>
      <header style={{ borderBottom: '1px solid ' + cullinosTheme.colors.border, paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ color: cullinosTheme.colors.amber, margin: 0 }}>Cullinos</h1>
        <p style={{ color: cullinosTheme.colors.muted, margin: '0.5rem 0 0' }}>Order Online</p>
      </header>
      <main>
        <div style={{ background: cullinosTheme.colors.charcoalLight, border: '1px solid ' + cullinosTheme.colors.border, borderRadius: '12px', padding: '2rem' }}>
          <p>Connected to Cullinos API at <code style={{ fontFamily: cullinosTheme.fonts.mono }}>localhost:3000</code></p>
          <p style={{ color: cullinosTheme.colors.muted, marginTop: '1rem' }}>Cullinos v0.1.0</p>
        </div>
      </main>
      <footer style={{ marginTop: "3rem", color: cullinosTheme.colors.muted, fontSize: "0.875rem" }}>{poweredByRkyves}</footer>
    </div>
  );
}
