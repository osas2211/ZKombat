import { useRef, useState, useEffect } from "react"
import {
  Bell,
  Settings,
  ChevronRight,
  MessageCircle,
  Wallet,
} from "lucide-react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import moment from "moment"
import { NeonButton } from "../components/NeonButton"
import { useWalletStandalone } from "../hooks/useWalletStandalone"
import "./SelectGamePage.css"

gsap.registerPlugin(ScrollTrigger)

const IMG = "/images/cover-img.jpg"

/* ──  logo SVG ── */
function PSLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
      <path d="M9.5 2.5v16.3l3.7 1.2V4.2c0-.7.3-1 .8-.8.6.2.8.7.8 1.4v6c2 .9 3.7.1 3.7-2.4 0-2.6-1.2-3.9-4.5-5-1.7-.5-3.2-.9-4.5-1V2.5zM6 14.3c-2.2-.6-4.1-.2-4.8 1.1-.8 1.3-.2 3 1.8 4 1.3.7 2.7 1 4 1.1v-3l-2.2-.7c-.6-.2-.7-.6-.3-.8.4-.2 1.2-.1 2.5.3v-2zm12.2 1.5c-1-.4-2.1-.5-3.2-.3v2.8l1.6.5c.6.2.7.6.3.8-.4.2-1.2.1-1.9-.2v3c1.8.5 3.3.2 4.2-.5.9-.8 1-2.4-.1-3.5-.4-.4-.6-.7-.9-1z" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════
   TOP BAR
   ═══════════════════════════════════════════════════════ */
function TopBar() {
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

/* ═══════════════════════════════════════════════════════
   HERO — Featured game banner + parallax
   ═══════════════════════════════════════════════════════ */
function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)

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
        <div className="flex items-end justify-between gap-4">
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
                Now Avaliable
              </p>
              <h1 className="text-[26px] !leading-[1.1] !font-[300] text-white md:!text-[64px] lg:!text-[72px]">
                ZKombat I - Stellar
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NeonButton className="shrink-0 gap-2 h-[45px] w-[150px] !text-white bg-[#000]!">
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
   ACTIVITY — Left column
   ═══════════════════════════════════════════════════════ */
function ActivitySection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  const items = [
    {
      color: "#4ade80",
      initial: "J",
      name: "JimmyMurphy12",
      text: "just scored playing season on Fifa 21",
    },
    {
      color: "#60a5fa",
      initial: "N",
      name: "NathanBOTCR1S16",
      text: "just added you as a friend on The Last of Us Part II",
    },
    {
      color: "#f472b6",
      initial: "M",
      name: "MyGirl_gaming",
      text: "just started playing Watch Dogs: Legion",
    },
  ]

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

      // Activity items slide from left
      gsap.fromTo(
        el.querySelectorAll(".activity-item"),
        { x: -40, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: trigger,
        },
      )

      // Avatar pop
      gsap.fromTo(
        el.querySelectorAll(".activity-avatar"),
        { scale: 0, rotation: -45 },
        {
          scale: 1,
          rotation: 0,
          duration: 0.5,
          stagger: 0.15,
          ease: "back.out(2)",
          scrollTrigger: trigger,
        },
      )
    },
    { scope: sectionRef },
  )

  return (
    <div
      ref={sectionRef}
      className="reveal-block shrink-0 md:w-64 lg:w-112 min-h-[430px] p-4 md:p-7 bg-[#262322]/55 backdrop-blur-[8px] rounded-md"
    >
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="section-heading text-[13px] font-semibold text-white">
          <span className="section-heading-text">Activity</span>
        </h2>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>
      {/* <div className="section-heading-line" /> */}

      {/* Feed items */}
      <div className="mt-3 flex flex-col gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="activity-item flex items-start gap-2.5 rounded-lg p-2.5"
          >
            {/* Colored avatar circle */}
            <div
              className="activity-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: item.color }}
            >
              <span className="text-[10px] font-bold text-white">
                {item.initial}
              </span>
            </div>

            {/* Text */}
            <p className="min-w-0 flex-1 text-[10px] leading-[1.45] text-white/50 md:text-[11px]">
              <span className="font-semibold text-white/80">{item.name}</span>{" "}
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   YOUR GAMES — Center column
   ═══════════════════════════════════════════════════════ */
function GamesSection() {
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

      // 3D tilt hover on cards
      const cards = el.querySelectorAll(".game-card")
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
          <span className="section-heading-text">Games catelog</span>
        </p>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>
      {/* <div className="section-heading-line" /> */}

      <div className="mt-3 grid grid-cols-3 gap-4">
        <div className="game-card">
          <img
            className="game-card-img w-full h-[280px] rounded-[3px]"
            src="/images/zkombat-cover.png"
          />
          <p className="text-green-500 !text-sm mt-2">Available</p>
        </div>
        <div className="game-card">
          <img
            className="game-card-img w-full h-[280px] rounded-[3px]"
            src="/images/game-2.png"
          />
          <p className="text-gray-500 !text-sm mt-2">Coming soon</p>
        </div>
        <div className="game-card">
          <img
            className="game-card-img w-full h-[280px] rounded-[3px]"
            src="/images/game-3.png"
          />
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
      className="collectables-section reveal-block w-full p-4 md:p-12 bg-[#262322]/50 backdrop-blur-[8px] rounded-md"
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
      className="news-section reveal-block w-full p-4 md:p-12 bg-[#262322]/50 backdrop-blur-[8px] rounded-md"
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

      <div className="mt-3">
        <img
          className="news-img w-full h-[300px] rounded-[3px] object-fill"
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
      <div className="relative z-10 px-5 pb-10 md:px-10 md:pl-[100px] -mt-[10rem]">
        {/* Activity + Your games + Store */}
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
          <ActivitySection />
          <GamesSection />
          <Store />
        </div>
        <div className="grid gap-6 grid-cols-2">
          <Collectables />
          <LatestNews />
        </div>
      </div>
    </div>
  )
}
