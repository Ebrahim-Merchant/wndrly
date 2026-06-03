import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
  style?: React.CSSProperties
}

/**
 * Animated skeleton loader block. Use as a placeholder for loading content.
 */
export function Skeleton({ width = '100%', height = 16, borderRadius = 6, className, style }: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--skeleton-bg, #e5e7eb)',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/**
 * Full-page skeleton for map pages (Atlas).
 */
export function AtlasSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Simulated map area */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }} className="md:!left-60">
        <Skeleton height="100%" borderRadius={0} style={{ background: 'var(--skeleton-bg, #e9ecef)' }} />
        {/* Floating panel placeholder */}
        <div style={{ position: 'absolute', top: 16, right: 16, width: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton height={40} borderRadius={10} />
          <Skeleton height={120} borderRadius={12} />
          <Skeleton height={80} borderRadius={12} />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for Journey detail page.
 */
export function JourneyDetailSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={32} width={300} borderRadius={8} />
        <Skeleton height={16} width={200} borderRadius={6} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
          <Skeleton height={80} borderRadius={12} />
          <Skeleton height={80} borderRadius={12} />
          <Skeleton height={80} borderRadius={12} />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={20} width={150} borderRadius={6} />
            <Skeleton height={120} borderRadius={12} />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for Vacay page.
 */
export function VacaySkeleton() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Skeleton height={36} width={120} borderRadius={20} />
          <Skeleton height={36} width={120} borderRadius={20} />
          <Skeleton height={36} width={120} borderRadius={20} />
        </div>
        <Skeleton height={400} borderRadius={16} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Skeleton height={160} borderRadius={12} />
          <Skeleton height={160} borderRadius={12} />
        </div>
      </div>
    </div>
  )
}
