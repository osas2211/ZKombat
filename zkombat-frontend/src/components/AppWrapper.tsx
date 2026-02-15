"use client"
import React, { ReactNode, useEffect, useRef } from "react"

import { AppLoader } from "./AppLoader"
import { SmoothScroller } from "./SmoothScroller"
import { Outlet, useLocation } from "react-router-dom"

export const AppWrapper = () => {
  const { pathname } = useLocation()
  const bodyRef: React.RefObject<HTMLDivElement | null> = useRef(null)
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, left: 0, behavior: "smooth" })
    }
  }, [pathname])
  return (
    <SmoothScroller>
      <div ref={bodyRef}>
        <AppLoader>
          <div className="min-h-screen">
            <main className="">
              <Outlet />
            </main>
          </div>
        </AppLoader>
      </div>
    </SmoothScroller>
  )
}
