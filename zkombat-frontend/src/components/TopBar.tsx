import { useState, useEffect } from "react"
import {
  Bell,
  Settings,
  MessageCircle,
  Wallet,
} from "lucide-react"
import moment from "moment"
import { useWalletStandalone } from "../hooks/useWalletStandalone"

/* ──  logo SVG ── */
function PSLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
      <path d="M9.5 2.5v16.3l3.7 1.2V4.2c0-.7.3-1 .8-.8.6.2.8.7.8 1.4v6c2 .9 3.7.1 3.7-2.4 0-2.6-1.2-3.9-4.5-5-1.7-.5-3.2-.9-4.5-1V2.5zM6 14.3c-2.2-.6-4.1-.2-4.8 1.1-.8 1.3-.2 3 1.8 4 1.3.7 2.7 1 4 1.1v-3l-2.2-.7c-.6-.2-.7-.6-.3-.8.4-.2 1.2-.1 2.5.3v-2zm12.2 1.5c-1-.4-2.1-.5-3.2-.3v2.8l1.6.5c.6.2.7.6.3.8-.4.2-1.2.1-1.9-.2v3c1.8.5 3.3.2 4.2-.5.9-.8 1-2.4-.1-3.5-.4-.4-.6-.7-.9-1z" />
    </svg>
  )
}

export function TopBar() {
  const [time, setTime] = useState(() => moment().format("h:mm a"))
  const { publicKey, isConnected, isConnecting, network, connect, disconnect } =
    useWalletStandalone()

  useEffect(() => {
    const id = setInterval(() => setTime(moment().format("h:mm a")), 30_000)
    return () => clearInterval(id)
  }, [])

  const address = typeof publicKey === "string" ? publicKey : ""
  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : ""

  return (
    <div className="reveal-block absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-5 py-3.5 md:px-10">
      {/* Left — Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
          <PSLogo />
        </div>
      </div>

      {/* Right — wallet, time, icons */}
      <div className="flex items-center gap-4">
        {/* Wallet */}
        {isConnected ? (
          <div className="flex items-center gap-2">
            {network && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-white/50 uppercase">
                {network}
              </span>
            )}
            <button
              onClick={disconnect}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/20"
            >
              <Wallet className="h-3 w-3" />
              {shortAddress}
            </button>
          </div>
        ) : (
          <button
            onClick={() => connect().catch(() => undefined)}
            disabled={isConnecting}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            <Wallet className="h-3 w-3" />
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}

        <span className="text-[13px] font-medium text-white/70">{time}</span>

        <div className="flex items-center gap-2.5">
          <button className="flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-white/50" />
          </button>
          <button className="flex items-center justify-center">
            <Bell className="h-4 w-4 text-white/50" />
          </button>
          <button className="flex items-center justify-center">
            <Settings className="h-4 w-4 text-white/50" />
          </button>
        </div>
      </div>
    </div>
  )
}
