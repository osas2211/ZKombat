import { Link } from "react-router-dom"

export function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <h1>ZKombat</h1>
      <p style={{ marginTop: "1rem", color: "var(--color-ink-muted, #888)" }}>
        Home page coming soon.
      </p>
      <Link
        to="/studio"
        style={{
          marginTop: "2rem",
          padding: "0.75rem 1.5rem",
          borderRadius: "0.5rem",
          background: "var(--color-accent, #6366f1)",
          color: "#fff",
          textDecoration: "none",
        }}
      >
        Go to Studio
      </Link>
    </div>
  )
}
