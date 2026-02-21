import { Routes, Route, Outlet, Navigate } from "react-router-dom"
import { Layout } from "./components/Layout"
import { SelectGamePage } from "./pages/SelectGamePage"
import { PlayPage } from "./pages/PlayPage"
import { AppWrapper } from "./components/AppWrapper"

const GAME_TITLE = import.meta.env.VITE_GAME_TITLE || "ZKombat"
const GAME_TAGLINE =
  import.meta.env.VITE_GAME_TAGLINE || "ZK-Verified Fighting Game on Stellar"

function AppLayout() {
  return (
    <Layout title={GAME_TITLE} subtitle={GAME_TAGLINE}>
      <Outlet />
    </Layout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/select-game" replace />} />
      </Route>
      <Route element={<AppWrapper />}>
        <Route element={<SelectGamePage />} path="select-game" />
        <Route element={<PlayPage />} path="play" />
      </Route>
    </Routes>
  )
}
