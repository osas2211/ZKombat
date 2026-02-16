"use client"
import React, { useEffect, useRef } from "react"
import gsap from "gsap"
import Lenis from "lenis"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export const SmoothScroller = ({ children }: { children: React.ReactNode }) => {
  const container = useRef(null)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    // Bridge Lenis scroll events to GSAP ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update)

    // Use GSAP ticker for synchronized RAF (GSAP gives seconds, Lenis wants ms)
    const rafCallback = (time: number) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(rafCallback)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(rafCallback)
      lenis.destroy()
    }
  }, [])

  return (
    <div ref={container} id="smooth-wrapper">
      <div id="smooth-content">{children}</div>
    </div>
  )
}
