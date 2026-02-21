import { useRef, useState, useEffect } from "react"
import { ChevronRight, Lock } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { NeonButton } from "../components/NeonButton"
import { TopBar } from "../components/TopBar"
import { ZkombatService } from "../games/zkombat/zkombatService"
import { ZKOMBAT_CONTRACT } from "../utils/constants"
import type { LeaderboardEntry, PlayerStats } from "../games/zkombat/bindings"
import "./SelectGamePage.css"

gsap.registerPlugin(ScrollTrigger)

const IMG = "/images/cover-img.jpg"

/* ═══════════════════════════════════════════════════════
   HERO — Featured game banner + parallax
   ═══════════════════════════════════════════════════════ */
function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useGSAP(
    () => {
      const hero = heroRef.current
      if (!hero) return

      const img = hero.querySelector(".hero-img_") as HTMLElement
      const content = hero.querySelector(".hero-content") as HTMLElement

      if (img) {
        gsap.to(img, {
          yPercent: 20,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        })
      }

      if (content) {
        gsap.to(content, {
          yPercent: -30,
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "80% top",
            scrub: true,
          },
        })
      }
    },
    { scope: heroRef },
  )

  return (
    <div
      ref={heroRef}
      className="relative h-[54vh] w-full overflow-hidden md:h-[58vh]"
    >
      {/* Background image */}
      <img
        src={IMG}
        alt="ZKombat"
        className="hero-img_ absolute inset-0 w-full object-cover will-change-transform"
      />

      {/* Dark gradient overlays for readability */}
      <div className="absolute inset-0 bg-linear-to-t from-[#0b0b0e] via-[#0b0b0e]/40 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-[#0b0b0e]/60 via-transparent to-transparent" />
      <div className="absolute right-0 bottom-0 left-0 h-32 bg-linear-to-t from-[#0b0b0e] to-transparent" />

      {/* Hero content */}
      <div className="hero-content reveal-block absolute right-0 bottom-10 left-0 z-10 px-5 will-change-transform md:bottom-[13rem] md:px-10 md:pl-[100px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          {/* Title block */}
          <div className="flex items-end gap-4">
            <div>
              <img
                src="/images/zkombat-cover.png"
                className="h-[150px] w-[100px] object-cover rounded-sm"
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-medium tracking-wider text-white/50 uppercase md:text-[11px]">
                Now Available
              </p>
              <h1 className="text-[26px] !leading-[1.1] !font-[300] text-white md:!text-[64px] lg:!text-[72px]">
                ZKombat I - Stellar
              </h1>
              <div className="mt-2 flex items-center gap-2">
                <span className="online-pulse-dot" />
                <span className="text-[11px] text-[#00fff0]/70">12 players online</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <NeonButton
              onClick={() => navigate("/play")}
              className="shrink-0 gap-2 h-[45px] w-[150px] !text-white bg-[#000]!"
            >
              Play now
            </NeonButton>
            <NeonButton
              neon={false}
              className="shrink-0 gap-2 h-[45px] w-[150px] !text-white !border-0 bg-[#000]!"
            >
              Share
            </NeonButton>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   LEADERBOARD — Left column
   ═══════════════════════════════════════════════════════ */
const RANK_COLORS = ["#facc15", "#a1a1aa", "#cd7c32", "#3b82f6", "#3b82f6"]

const zkombatService = new ZkombatService(ZKOMBAT_CONTRACT)

interface LeaderboardRow {
  rank: number
  address: string
  points: bigint
  wins: number
  losses: number
  color: string
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

function LeaderboardSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    async function fetchLeaderboard() {
      try {
        const entries: LeaderboardEntry[] = await zkombatService.getLeaderboard()
        if (entries.length === 0) {
          setLoading(false)
          return
        }

        // Fetch player stats in parallel for wins/losses
        const statsPromises = entries.map((e) =>
          zkombatService.getPlayerStats(e.player).catch(() => null)
        )
        const stats = await Promise.all(statsPromises)

        const leaderboard: LeaderboardRow[] = entries.map((entry, i) => {
          const playerStats: PlayerStats | null = stats[i]
          return {
            rank: i + 1,
            address: entry.player,
            points: typeof entry.points === "bigint" ? entry.points : BigInt(entry.points),
            wins: playerStats?.wins ?? 0,
            losses: playerStats?.losses ?? 0,
            color: RANK_COLORS[Math.min(i, RANK_COLORS.length - 1)],
          }
        })

        setRows(leaderboard)
      } catch (err) {
        console.warn("[Leaderboard] Failed to fetch:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  useGSAP(
    () => {
      const el = sectionRef.current
      if (!el) return

      const trigger = {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none" as const,
      }

      // Heading text reveal
      gsap.fromTo(
        el.querySelector(".section-heading-text"),
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: trigger,
        },
      )

      // Neon line
      gsap.to(el.querySelector(".section-heading-line"), {
        scaleX: 1,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: trigger,
      })

      // Leaderboard rows slide from left
      gsap.fromTo(
        el.querySelectorAll(".lb-row"),
        { x: -40, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: trigger,
        },
      )

      // Avatar pop
      gsap.fromTo(
        el.querySelectorAll(".lb-avatar"),
        { scale: 0, rotation: -45 },
        {
          scale: 1,
          rotation: 0,
          duration: 0.5,
          stagger: 0.1,
          ease: "back.out(2)",
          scrollTrigger: trigger,
        },
      )
    },
    { scope: sectionRef, dependencies: [rows] },
  )

  return (
    <div
      ref={sectionRef}
      className="reveal-block shrink-0 md:w-64 lg:w-112 min-h-[430px] p-4 md:p-7 bg-[#262322]/55 backdrop-blur-[8px] rounded-md"
    >
      {/* Section header */}
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="section-heading text-[13px] font-semibold text-white">
          <span className="section-heading-text">Leaderboard</span>
        </h2>
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Season 1</span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="lb-spinner" />
          <p className="mt-3 text-[11px] text-white/30">Loading leaderboard...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-[12px] text-white/40">No matches played yet</p>
          <p className="mt-1 text-[10px] text-white/20">Be the first on the leaderboard!</p>
        </div>
      ) : (
        <>
          {/* Column labels */}
          <div className="mb-2 flex items-center gap-2.5 px-2.5 text-[9px] font-medium tracking-wider text-white/25 uppercase">
            <span className="w-5 text-center">#</span>
            <span className="w-8" />
            <span className="flex-1">Player</span>
            <span className="w-10 text-right">W</span>
            <span className="w-10 text-right">L</span>
            <span className="w-14 text-right">Win %</span>
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-1">
            {rows.map((p) => {
              const total = p.wins + p.losses
              const winRate = total > 0 ? Math.round((p.wins / total) * 100) : 0
              const isTop3 = p.rank <= 3
              return (
                <div
                  key={p.address}
                  className={`lb-row flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${isTop3 ? "lb-row--top" : ""}`}
                >
                  {/* Rank */}
                  <span
                    className={`w-5 text-center text-[11px] font-bold ${isTop3 ? "" : "text-white/30"}`}
                    style={isTop3 ? { color: p.color } : undefined}
                  >
                    {p.rank}
                  </span>

                  {/* Avatar */}
                  <div
                    className="lb-avatar flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: p.color }}
                  >
                    <span className="text-[9px] font-bold text-white">
                      {p.address[0]}
                    </span>
                  </div>

                  {/* Address */}
                  <span className="flex-1 min-w-0 truncate text-[11px] font-medium text-white/80 font-mono">
                    {truncateAddress(p.address)}
                  </span>

                  {/* Wins */}
                  <span className="w-10 text-right text-[11px] text-green-400/80">
                    {p.wins}
                  </span>

                  {/* Losses */}
                  <span className="w-10 text-right text-[11px] text-red-400/60">
                    {p.losses}
                  </span>

                  {/* Win rate bar */}
                  <div className="w-14 flex items-center justify-end gap-1.5">
                    <div className="lb-bar-track">
                      <div className="lb-bar-fill" style={{ width: `${winRate}%` }} />
                    </div>
                    <span className="text-[10px] text-white/40">{winRate}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   YOUR GAMES — Center column
   ═══════════════════════════════════════════════════════ */
function GamesSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useGSAP(
    () => {
      const el = sectionRef.current
      if (!el) return

      const trigger = {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none" as const,
      }

      // Heading text reveal
      gsap.fromTo(
        el.querySelector(".section-heading-text"),
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: trigger,
        },
      )

      // Neon line
      gsap.to(el.querySelector(".section-heading-line"), {
        scaleX: 1,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: trigger,
      })

      // Cards stagger
      gsap.fromTo(
        el.querySelectorAll(".game-card"),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: trigger,
        },
      )

      // Image clip-path reveal (left to right)
      gsap.fromTo(
        el.querySelectorAll(".game-card-img"),
        { clipPath: "inset(0 100% 0 0)" },
        {
          clipPath: "inset(0 0% 0 0)",
          duration: 1.2,
          stagger: 0.2,
          ease: "power4.inOut",
          scrollTrigger: trigger,
        },
      )

      // 3D tilt hover on cards (skip locked cards)
      const cards = el.querySelectorAll(".game-card:not(.game-card--locked)")
      cards.forEach((card) => {
        const cardEl = card as HTMLElement

        const handleMouseMove = (e: MouseEvent) => {
          const rect = cardEl.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          const centerX = rect.width / 2
          const centerY = rect.height / 2

          const rotateX = ((y - centerY) / centerY) * -8
          const rotateY = ((x - centerX) / centerX) * 8

          gsap.to(cardEl, {
            rotateX,
            rotateY,
            scale: 1.03,
            duration: 0.4,
            ease: "power2.out",
            transformPerspective: 800,
            transformOrigin: "center center",
          })

          cardEl.style.setProperty("--glow-x", `${(x / rect.width) * 100}%`)
          cardEl.style.setProperty("--glow-y", `${(y / rect.height) * 100}%`)
        }

        const handleMouseLeave = () => {
          gsap.to(cardEl, {
            rotateX: 0,
            rotateY: 0,
            scale: 1,
            duration: 0.6,
            ease: "power3.out",
          })
        }

        cardEl.addEventListener("mousemove", handleMouseMove)
        cardEl.addEventListener("mouseleave", handleMouseLeave)
      })
    },
    { scope: sectionRef },
  )

  return (
    <div
      ref={sectionRef}
      className="reveal-block shrink-0 md:w-64 lg:w-200 p-4 md:p-9 bg-[#262322]/40 backdrop-blur-[8px] rounded-md"
    >
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <p className="section-heading !text-[20px] !font-[300] text-white">
          <span className="section-heading-text">Games Catalog</span>
        </p>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>
      {/* <div className="section-heading-line" /> */}

      <div className="mt-3 grid grid-cols-3 gap-4">
        {/* Available card */}
        <div
          className="game-card game-card--available"
          onClick={() => navigate("/play")}
        >
          <img
            className="game-card-img w-full h-[280px] rounded-[3px]"
            src="/images/zkombat-cover.png"
          />
          <div className="game-card-overlay">
            <p className="text-[13px] font-semibold text-white">ZKombat</p>
            <p className="text-[11px] text-white/60 mt-0.5">PvP fighting on Stellar</p>
          </div>
          <p className="text-green-500 !text-sm mt-2">Available</p>
        </div>

        {/* Coming Soon cards */}
        <div className="game-card game-card--locked">
          <img
            className="game-card-img w-full h-[280px] rounded-[3px]"
            src="/images/game-2.png"
          />
          <div className="game-card-lock-badge">
            <span><Lock className="h-5 w-5 text-white/50" /></span>
          </div>
          <p className="text-gray-500 !text-sm mt-2">Coming soon</p>
        </div>
        <div className="game-card game-card--locked">
          <img
            className="game-card-img w-full h-[280px] rounded-[3px]"
            src="/images/game-3.png"
          />
          <div className="game-card-lock-badge">
            <span><Lock className="h-5 w-5 text-white/50" /></span>
          </div>
          <p className="text-gray-500 !text-sm mt-2">Coming soon</p>
        </div>
      </div>
    </div>
  )
}

function Collectables() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = sectionRef.current
      if (!el) return

      const trigger = {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none" as const,
      }

      // Heading text reveal
      gsap.fromTo(
        el.querySelector(".section-heading-text"),
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: trigger,
        },
      )

      // Neon line
      gsap.to(el.querySelector(".section-heading-line"), {
        scaleX: 1,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: trigger,
      })

      // Image clip-path reveal (bottom to top)
      gsap.fromTo(
        el.querySelectorAll(".collectable-card-img"),
        { clipPath: "inset(100% 0 0 0)" },
        {
          clipPath: "inset(0% 0 0 0)",
          duration: 1.4,
          stagger: 0.18,
          ease: "power4.inOut",
          scrollTrigger: trigger,
        },
      )
    },
    { scope: sectionRef },
  )

  return (
    <div
      ref={sectionRef}
      className="collectables-section reveal-block w-full h-full p-4 md:p-12 bg-[#262322]/50 backdrop-blur-[8px] rounded-md"
    >
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <p className="section-heading !text-[20px] !font-[300] text-white">
          <span className="section-heading-text">Collectables</span>
        </p>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>
      {/* <div className="section-heading-line" /> */}

      <div className="mt-3 grid grid-cols-3 gap-4">
        <div>
          <img
            className="collectable-card-img w-full h-[300px] rounded-[3px]"
            src="/images/collectables/collectible-1.jpg"
          />
          <p className="text-gray-500 !text-sm mt-2">Coming soon</p>
        </div>
        <div>
          <img
            className="collectable-card-img w-full h-[300px] rounded-[3px]"
            src="/images/collectables/nft3.webp"
          />
          <p className="text-gray-500 !text-sm mt-2">Coming soon</p>
        </div>
        <div>
          <img
            className="collectable-card-img w-full h-[300px] rounded-[3px]"
            src="/images/collectables/nft2.webp"
          />
          <p className="text-gray-500 !text-sm mt-2">Coming soon</p>
        </div>
      </div>
    </div>
  )
}

function LatestNews() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = sectionRef.current
      if (!el) return

      const trigger = {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none" as const,
      }

      // Heading text reveal
      gsap.fromTo(
        el.querySelector(".section-heading-text"),
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: trigger,
        },
      )

      // Neon line
      gsap.to(el.querySelector(".section-heading-line"), {
        scaleX: 1,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: trigger,
      })

      // Image clip-path reveal (center outward)
      gsap.fromTo(
        el.querySelector(".news-img"),
        { clipPath: "inset(0 50% 0 50%)" },
        {
          clipPath: "inset(0 0% 0 0%)",
          duration: 1.4,
          ease: "power4.inOut",
          scrollTrigger: trigger,
        },
      )
    },
    { scope: sectionRef },
  )

  return (
    <div
      ref={sectionRef}
      className="news-section reveal-block w-full h-full flex flex-col p-4 md:p-12 bg-[#262322]/50 backdrop-blur-[8px] rounded-md"
    >
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <p className="section-heading !text-[20px] !font-[300] text-white">
          <span className="section-heading-text">Latest News</span>
        </p>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>
      {/* <div className="section-heading-line" /> */}

      <div className="mt-3 flex-1">
        <img
          className="news-img w-full h-full min-h-[300px] rounded-[3px] object-cover"
          src="/images/stellar-hackathon.jpg"
        />
      </div>
    </div>
  )
}

function Store() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = sectionRef.current
      if (!el) return

      const trigger = {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none" as const,
      }

      // Heading text reveal
      gsap.fromTo(
        el.querySelector(".section-heading-text"),
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: trigger,
        },
      )

      // Neon line
      gsap.to(el.querySelector(".section-heading-line"), {
        scaleX: 1,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: trigger,
      })
    },
    { scope: sectionRef },
  )

  return (
    <div
      ref={sectionRef}
      className="reveal-block shrink-0 md:w-64 lg:w-200 p-4 md:p-9 bg-[#262322]/40 backdrop-blur-[8px] rounded-md"
    >
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <p className="section-heading !text-[20px] !font-[300] text-white">
          <span className="section-heading-text">Store</span>
        </p>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>
      {/* <div className="section-heading-line" /> */}

      {/* Coming Soon Banner */}
      <div className="mt-4 flex flex-col items-center">
        <img
          className="w-full h-[270px] object-cover rounded-sm"
          src="/images/coming-soon-banner.jpg"
          alt="Coming Soon"
        />
        <p className="mt-2 text-center text-white/70 text-sm">Coming Soon</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   STORE — Right side link
   ═══════════════════════════════════════════════════════ */
function StoreLink() {
  return (
    <div className="reveal-block hidden shrink-0 pt-8 md:block">
      <button className="flex items-center gap-0.5 text-[13px] font-semibold text-white/40 hover:text-white/70">
        Store
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   PAGE ROOT
   ═══════════════════════════════════════════════════════ */
export const SelectGamePage = () => {
  return (
    <div className="select-game-page relative min-h-screen overflow-x-hidden bg-[#0b0b0e] text-white">
      <TopBar />
      <HeroSection />

      {/* Content below hero */}
      <div className="content-overlap relative z-10 px-5 pb-10 md:px-10 md:pl-[100px]">
        {/* Activity + Your games + Store */}
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
          <LeaderboardSection />
          <GamesSection />
          <Store />
        </div>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 lg:items-start">
          <Collectables />
          <LatestNews />
        </div>
      </div>
    </div>
  )
}
