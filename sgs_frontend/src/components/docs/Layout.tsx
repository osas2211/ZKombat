import { NavLink, Outlet } from "react-router-dom"
import { WalletSwitcher } from "./WalletSwitcher"
import studioLogo from "../../assets/logo.svg"
import "./Layout.css"

export function Layout() {
  return (
    <div className="studio">
      <div className="studio-background" aria-hidden="true">
        <div className="studio-orb orb-1" />
        <div className="studio-orb orb-2" />
        <div className="studio-orb orb-3" />
        <div className="studio-grid" />
      </div>

      <header className="studio-header">
        <div className="brand">
          <div className="brand-heading">
            <img
              className="brand-logo"
              src={studioLogo}
              alt="Stellar Game Studio logo"
            />
            <div className="brand-copy">
              <div className="brand-title">Stellar Game Studio</div>
              <div className="brand-subtitle-row">
                <p className="brand-subtitle">
                  A DEVELOPER TOOLKIT FOR BUILDING WEB3 GAMES ON STELLAR
                </p>
                <span className="brand-version">v0.1.2</span>
              </div>
            </div>
          </div>
          <nav className="header-nav">
            <NavLink
              to="/studio"
              end
              className={({ isActive }) =>
                `header-link ${isActive ? "active" : ""}`
              }
            >
              Studio
            </NavLink>
            <NavLink
              to="/studio/games"
              className={({ isActive }) =>
                `header-link ${isActive ? "active" : ""}`
              }
            >
              Games Library
            </NavLink>
            <NavLink
              to="/studio/docs"
              className={({ isActive }) =>
                `header-link ${isActive ? "active" : ""}`
              }
            >
              Documentation
            </NavLink>
          </nav>
        </div>
        <div className="header-actions">
          <div className="network-pill">Testnet</div>
          <WalletSwitcher />
        </div>
      </header>

      <main className="studio-main">
        <Outlet />
      </main>

      <footer className="studio-footer">
        <span className="footer-meta">
          Built with ♥️ for Stellar game developers
        </span>
      </footer>
    </div>
  )
}
