"use client"

import { ReactNode, useCallback, useEffect, useRef } from "react"
import { useGSAP } from "@gsap/react"
import { useLocation } from "react-router-dom"
import gsap from "gsap"
import CustomEase from "gsap/dist/CustomEase"
import { NeonButton } from "./NeonButton"
import "./webloader.css"

export function AppLoader({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const isSelectGame = pathname === "/select-game"

  const handleEnter = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play()
    }
    if (timelineRef.current) {
      gsap.to(".enter-btn", { opacity: 0, duration: 0.3 })
      timelineRef.current.resume()
    }
  }, [])

  useEffect(() => {
    gsap.registerPlugin(CustomEase)
    CustomEase.create("hop", "0.9, 0, 0.1, 1")
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }, [])
  const scope = useRef(null)

  useGSAP(
    () => {
      // gsap.set(".loader", { display: "block" })
      gsap.set(".hero-img_", { scale: 1.5 })
      gsap.set(".reveal-block", { opacity: 0 })
      const tl = gsap.timeline({
        delay: 0.3,
        defaults: {
          ease: "hop",
        },
      })
      timelineRef.current = tl

      const counts = document.querySelectorAll(".count")

      counts.forEach((count, index) => {
        const digits = count.querySelectorAll(".digit h1")

        tl.to(
          digits,
          {
            y: "0%",
            duration: 1,
            stagger: 0.075,
          },
          index * 1,
        )

        if (index < counts.length) {
          tl.to(
            digits,
            {
              y: "-100%",
              duration: 1,
              stagger: 0.075,
            },
            index * 1 + 1,
          )
        }
      })

      tl.to(".spinner", {
        opacity: 0,
        duration: 0.3,
      })

      tl.to(
        ".word h1",
        {
          y: "0%",
          duration: 1,
        },
        "<",
      )

      tl.to(".divider", {
        scaleY: "100%",
        duration: 0.15,
        onComplete: () => {
          gsap.to(".divider", { opacity: 0, duration: 0.1, delay: 0.1 })
        },
      })

      // Show enter button and pause for user interaction on select-game
      if (isSelectGame) {
        tl.to(".enter-btn", {
          opacity: 1,
          duration: 0.6,
        })
        tl.addPause()
      }

      tl.to("#word-1 h1", {
        y: "100%",
        duration: 1,
        delay: 0.3,
      })

      tl.to(
        "#word-2 h1",
        {
          y: "-100%",
          duration: 1,
        },
        "<",
      )

      tl.to(
        ".block",
        {
          clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
          duration: 1,
          stagger: 0.1,
          delay: 0.75,
          onStart: () => {
            gsap.fromTo(
              ".hero-img_",
              { scale: 1.5 },
              { scale: 1, duration: 2, ease: "hop" },
            )
            gsap.fromTo(
              ".reveal-block",
              { opacity: 0 },
              { opacity: 1, duration: 2, ease: "hop" },
            )
            // gsap.to(".loader", { display: "none" })
          },
        },
        "<",
      )

      tl.to(
        [".nav", ".line h1", ".line p"],
        {
          y: "0%",
          duration: 1.5,
          stagger: 0.2,
        },
        "<",
      )

      tl.to(
        [".cta", ".cta-icon"],
        {
          scale: 1,
          duration: 1.5,
          stagger: 0.75,
          delay: 0.75,
        },
        "<",
      )

      tl.to(
        ".cta-label p",
        {
          y: "0%",
          duration: 1.5,
          delay: 0.5,
        },
        "<",
      )
    },
    { scope, dependencies: [] },
  )

  return (
    <div ref={scope as any}>
      <div className="loader w-screen">
        <div className="overlay">
          <div className="block" />
          <div className="block" />
        </div>

        <div className="intro-logo">
          <div className="word" id="word-1">
            <h1>
              <span className="pr-8">ZKombat </span>
            </h1>
          </div>
          <div className="word -ml-2" id="word-2">
            <h1>Stellar</h1>
          </div>
        </div>

        <div className="divider !bg-transparent" />

        <div className="spinner-container">
          <div className="spinner" />
        </div>

        <div className="counter">
          <div className="count">
            <div className="digit">
              <h1>0</h1>
            </div>
            <div className="digit">
              <h1>0</h1>
            </div>
          </div>
          <div className="count">
            <div className="digit">
              <h1>2</h1>
            </div>
            <div className="digit">
              <h1>7</h1>
            </div>
          </div>
          <div className="count">
            <div className="digit">
              <h1>5</h1>
            </div>
            <div className="digit">
              <h1>2</h1>
            </div>
          </div>
          <div className="count">
            <div className="digit">
              <h1>7</h1>
            </div>
            <div className="digit">
              <h1>8</h1>
            </div>
          </div>
          <div className="count">
            <div className="digit">
              <h1>9</h1>
            </div>
            <div className="digit">
              <h1>9</h1>
            </div>
          </div>
        </div>
      </div>

      {isSelectGame && (
        <div
          className="enter-btn fixed inset-0 z-[999] flex items-end justify-center pb-[20%] pointer-events-none"
          style={{ opacity: 0 }}
        >
          <NeonButton
            onClick={handleEnter}
            className="px-10 py-3 text-lg tracking-widest cursor-pointer! pointer-events-auto"
          >
            ENTER
          </NeonButton>
        </div>
      )}

      <audio loop ref={audioRef} preload="auto">
        <source src="/music/arabic-chant.mp3" type="audio/mp3" />
      </audio>

      <div className="relative">{children}</div>
    </div>
  )
}
