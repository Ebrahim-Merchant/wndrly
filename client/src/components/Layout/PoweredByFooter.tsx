import React from 'react'

interface PoweredByFooterProps {
  style?: React.CSSProperties
  className?: string
}

/**
 * Branded footer shown on public/shared pages.
 * Replaces raw inline font-size:10px / "Made with ♥ by Maurice" footers.
 */
export default function PoweredByFooter({ style, className }: PoweredByFooterProps) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: '#9ca3af',
        ...style,
      }}
    >
      <img src="/icons/icon.svg" alt="Wndrly" width={14} height={14} style={{ borderRadius: 3, opacity: 0.7 }} />
      <span>
        Shared via{' '}
        <strong style={{ color: '#6b7280', fontWeight: 600 }}>Wndrly</strong>
      </span>
    </div>
  )
}
