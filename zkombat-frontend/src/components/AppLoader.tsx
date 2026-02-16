"use client"

import { ReactNode, useEffect, useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import CustomEase from "gsap/dist/CustomEase"
import "./webloader.css"

export function AppLoader({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(CustomEase)
    CustomEase.create("hop", "0.9, 0, 0.1, 1")
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

      <div className="relative">{children}</div>
    </div>
  )
}
