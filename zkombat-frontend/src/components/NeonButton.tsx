import { ButtonHTMLAttributes, ReactNode } from "react"
import "./NeonButton.css"

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  neon?: boolean
  color?: string
}

export function NeonButton({
  children,
  neon = true,
  color = "#00fff0",
  className = "",
  style,
  ...rest
}: NeonButtonProps) {
  return (
    <button
      className={`neon-btn ${neon ? "neon-on" : ""} ${className}`}
      style={
        {
          "--neon-color": color,
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    >
      {children}
    </button>
  )
}
