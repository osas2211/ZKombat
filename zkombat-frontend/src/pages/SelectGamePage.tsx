import { Bell, Settings, ChevronRight, MessageCircle } from "lucide-react"
import { NeonButton } from "../components/NeonButton"
import "./SelectGamePage.css"

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
  return (
    <div className="reveal-block absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-5 py-3.5 md:px-10">
      {/* Left — PS logo + profile avatar */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
          <PSLogo />
        </div>
        <div className="h-7 w-7 overflow-hidden rounded-full">
          <img src={IMG} alt="avatar" className="h-full w-full object-cover" />
        </div>
      </div>

      {/* Right — status text, time, icons */}
      <div className="flex items-center gap-4">
        <span className="hidden text-[10px] font-medium tracking-wider text-white/50 uppercase md:block">
          Game base, ENG
        </span>
        <span className="text-[13px] font-medium text-white/70">1:06pm</span>
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
   HERO — Featured game banner
   ═══════════════════════════════════════════════════════ */
function HeroSection() {
  return (
    <div className="relative h-[54vh] w-full overflow-hidden md:h-[58vh]">
      {/* Background image */}
      <img
        src={IMG}
        alt="The Last of Us Part II"
        className="hero-img_ absolute inset-0 h-full w-full object-cover"
      />

      {/* Dark gradient overlays for readability */}
      <div className="absolute inset-0 bg-linear-to-t from-[#0b0b0e] via-[#0b0b0e]/40 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-[#0b0b0e]/60 via-transparent to-transparent" />
      <div className="absolute right-0 bottom-0 left-0 h-32 bg-linear-to-t from-[#0b0b0e] to-transparent" />

      {/* Hero content */}
      <div className="reveal-block absolute right-0 bottom-10 left-0 z-10 px-5 md:bottom-[13rem] md:px-10 md:pl-[100px]">
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

  return (
    <div className="reveal-block shrink-0 md:w-64 lg:w-112 p-4 md:p-7 bg-[#070f11]/70 backdrop-blur-[8px] rounded-md">
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-white">Activity</h2>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>

      {/* Feed items */}
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-lg  p-2.5">
            {/* Colored avatar circle */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
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
  return (
    <div className="reveal-block shrink-0 md:w-64 lg:w-200 p-4 md:p-9 bg-[#070f11]/40 backdrop-blur-[8px] rounded-md">
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <p className="!text-[20px] !font-[300] text-white">Games catelog</p>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <img
            className="w-full h-[280px] rounded-[3px]"
            src="/images/zkombat-cover.png"
          />
          <p className="text-green-500 !text-sm">Available</p>
        </div>
        <div>
          <img
            className="w-full h-[280px] rounded-[3px]"
            src="/images/game-2.png"
          />
          <p className="text-gray-500 !text-sm">Coming soon</p>
        </div>
        <div>
          <img
            className="w-full h-[280px] rounded-[3px]"
            src="/images/game-3.png"
          />
          <p className="text-gray-500 !text-sm">Coming soon</p>
        </div>
      </div>
    </div>
  )
}

function Collectables() {
  return (
    <div className="reveal-block w-full p-4 md:p-12 bg-[#070f11] backdrop-blur-[8px] rounded-md">
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <p className="!text-[20px] !font-[300] text-white">Collectables</p>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <img
            className="w-full h-[300px] rounded-[3px]"
            src="/images/collectables/collectible-1.jpg"
          />
          <p className="text-gray-500 !text-sm">Coming soon</p>
        </div>
        <div>
          <img
            className="w-full h-[300px] rounded-[3px]"
            src="/images/collectables/nft3.webp"
          />
          <p className="text-gray-500 !text-sm">Coming soon</p>
        </div>
        <div>
          <img
            className="w-full h-[300px] rounded-[3px]"
            src="/images/collectables/nft2.webp"
          />
          <p className="text-gray-500 !text-sm">Coming soon</p>
        </div>
      </div>
    </div>
  )
}

function LatestNews() {
  return (
    <div className="reveal-block w-full p-4 md:p-12 bg-[#070f11] backdrop-blur-[8px] rounded-md">
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <p className="!text-[20px] !font-[300] text-white">Latest News</p>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>

      <div>
        <img
          className="w-full h-[300px] rounded-[3px] object-fill"
          src="/images/stellar-hackathon.jpg"
        />
      </div>
    </div>
  )
}

function Store() {
  return (
    <div className="reveal-block shrink-0 md:w-64 lg:w-200 p-4 md:p-9 bg-[#070f11]/40 backdrop-blur-[8px] rounded-md">
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between">
        <p className="!text-[20px] !font-[300] text-white">Store</p>
        <button className="text-[11px] text-white/40 hover:text-white/70">
          {/* All activity */}
        </button>
      </div>

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
