import React, { useRef } from 'react'

interface LiquidGlassProps {
  children: React.ReactNode
  dark?: boolean
  style?: React.CSSProperties
  className?: string
  onClick?: () => void
}

export default function LiquidGlass({ children, dark = false, style, className = '', onClick }: LiquidGlassProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const borderRef = useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!ref.current || !glareRef.current || !borderRef.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    glareRef.current.style.background = `radial-gradient(circle 250px at ${x}px ${y}px, ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'} 0%, transparent 70%)`
    glareRef.current.style.opacity = '1'
    borderRef.current.style.opacity = '1'
    borderRef.current.style.maskImage = `radial-gradient(circle 120px at ${x}px ${y}px, black 0%, transparent 100%)`
    borderRef.current.style.WebkitMaskImage = `radial-gradient(circle 120px at ${x}px ${y}px, black 0%, transparent 100%)`
  }
  const onLeave = () => {
    if (glareRef.current) glareRef.current.style.opacity = '0'
    if (borderRef.current) borderRef.current.style.opacity = '0'
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      <div
        ref={glareRef}
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0,
          transition: 'opacity 0.3s', borderRadius: 'inherit', zIndex: 1,
        }}
      />
      <div
        ref={borderRef}
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0,
          transition: 'opacity 0.3s', borderRadius: 'inherit', zIndex: 1,
          border: dark ? '1.5px solid rgba(255,255,255,0.4)' : '1.5px solid rgba(0,0,0,0.12)',
        }}
      />
      {children}
    </div>
  )
}
