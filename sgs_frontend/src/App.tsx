import { Routes, Route } from "react-router-dom"
import { config } from "./config"
import { Layout } from "./components/docs/Layout"
import { GamesCatalog } from "./components/docs/GamesCatalog"
import { DocsPage } from "./pages/DocsPage"
import { StudioHomePage } from "./pages/HomePage"
import { HomePage } from "./pages/Home"

function SetupBanner() {
  return (
    <div className="card" style={{ marginBottom: "2rem" }}>
      <h3>Setup Required</h3>
      <p style={{ color: "var(--color-ink-muted)", marginTop: "1rem" }}>
        Contract IDs not configured. Please run <code>bun run setup</code> from
        the repo root to deploy contracts and configure the studio frontend.
      </p>
    </div>
  )
}

function App() {
  const hasAnyContracts = Object.keys(config.contractIds).length > 0

  return (
    <Routes>
      {/* Your own pages */}
      <Route path="/" element={<HomePage />} />

      {/* Studio pages — wrapped in the existing Layout */}
      <Route path="studio" element={<Layout />}>
        <Route
          index
          element={
            <>
              {!hasAnyContracts && <SetupBanner />}
              <StudioHomePage />
            </>
          }
        />
        <Route
          path="games"
          element={
            <>
              {!hasAnyContracts && <SetupBanner />}
              <GamesCatalog />
            </>
          }
        />
        <Route
          path="docs"
          element={
            <>
              {!hasAnyContracts && <SetupBanner />}
              <DocsPage />
            </>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
