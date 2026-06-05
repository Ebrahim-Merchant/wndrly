import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { LucideIcon, ChevronRight } from 'lucide-react'

interface MenuItem {
  label?: string
  icon?: LucideIcon
  onClick?: () => void
  danger?: boolean
  divider?: boolean
  submenu?: MenuItem[]
  disabled?: boolean
}

interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null)

  const open = (e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  const close = () => setMenu(null)

  return { menu, open, close }
}

interface ContextMenuProps {
  menu: MenuState | null
  onClose: () => void
}

interface SubMenuProps {
  items: MenuItem[]
  onClose: () => void
  parentRef: React.RefObject<HTMLButtonElement | null>
}

function SubMenu({ items, onClose, parentRef }: SubMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!parentRef.current || !ref.current) return
    const parentRect = parentRef.current.getBoundingClientRect()
    const menuEl = ref.current
    const menuRect = menuEl.getBoundingClientRect()
    let left = parentRect.right + 4
    let top = parentRect.top
    // Flip left if near right edge
    if (left + menuRect.width > window.innerWidth - 8) {
      left = parentRect.left - menuRect.width - 4
    }
    // Clamp vertically
    if (top + menuRect.height > window.innerHeight - 8) {
      top = window.innerHeight - menuRect.height - 8
    }
    setPos({ left, top })
  }, [parentRef])

  return ReactDOM.createPortal(
    <div ref={ref} style={{
      position: 'fixed',
      left: pos ? pos.left : -9999,
      top: pos ? pos.top : -9999,
      zIndex: 1000000,
      background: 'var(--bg-card)',
      borderRadius: 10,
      padding: '4px',
      border: '1px solid var(--border-primary)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      minWidth: 160,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    }}>
      {items.filter(Boolean).map((item, i) => {
        if (item.divider) return <div key={i} style={{ height: 1, background: 'var(--border-faint)', margin: '3px 6px' }} />
        const Icon = item.icon
        return (
          <button key={i} onClick={() => { if (!item.disabled) { item.onClick?.(); onClose() } }} disabled={item.disabled} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '7px 10px', borderRadius: 7, border: 'none',
            background: 'none', cursor: item.disabled ? 'default' : 'pointer', fontFamily: 'inherit',
            fontSize: 12, fontWeight: 500, textAlign: 'left',
            color: item.disabled ? 'var(--text-faint)' : item.danger ? '#ef4444' : 'var(--text-primary)',
            transition: 'background 0.1s',
            opacity: item.disabled ? 0.5 : 1,
          }}
            onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.08)' : 'var(--bg-hover)' }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {Icon && <Icon size={13} style={{ flexShrink: 0, color: item.disabled ? 'var(--text-faint)' : item.danger ? '#ef4444' : 'var(--text-faint)' }} />}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}

interface MenuItemRowProps {
  item: MenuItem
  onClose: () => void
}

function MenuItemRow({ item, onClose }: MenuItemRowProps) {
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const Icon = item.icon

  if (item.submenu && item.submenu.length > 0) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          ref={buttonRef}
          onMouseEnter={() => setSubmenuOpen(true)}
          onMouseLeave={() => setSubmenuOpen(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '7px 10px', borderRadius: 7, border: 'none',
            background: submenuOpen ? 'var(--bg-hover)' : 'none',
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, fontWeight: 500, textAlign: 'left',
            color: 'var(--text-primary)',
            transition: 'background 0.1s',
          }}
        >
          {Icon && <Icon size={13} style={{ flexShrink: 0, color: 'var(--text-faint)' }} />}
          <span style={{ flex: 1 }}>{item.label}</span>
          <ChevronRight size={11} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        </button>
        {submenuOpen && (
          <div
            onMouseEnter={() => setSubmenuOpen(true)}
            onMouseLeave={() => setSubmenuOpen(false)}
          >
            <SubMenu items={item.submenu} onClose={onClose} parentRef={buttonRef} />
          </div>
        )}
      </div>
    )
  }

  return (
    <button onClick={() => { if (!item.disabled) { item.onClick?.(); onClose() } }} disabled={item.disabled} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '7px 10px', borderRadius: 7, border: 'none',
      background: 'none', cursor: item.disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      fontSize: 12, fontWeight: 500, textAlign: 'left',
      color: item.disabled ? 'var(--text-faint)' : item.danger ? '#ef4444' : 'var(--text-primary)',
      transition: 'background 0.1s',
      opacity: item.disabled ? 0.5 : 1,
    }}
      onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.08)' : 'var(--bg-hover)' }}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {Icon && <Icon size={13} style={{ flexShrink: 0, color: item.disabled ? 'var(--text-faint)' : item.danger ? '#ef4444' : 'var(--text-faint)' }} />}
      <span>{item.label}</span>
    </button>
  )
}

export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const handler = () => onClose()
    document.addEventListener('click', handler)
    document.addEventListener('contextmenu', handler)
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('contextmenu', handler)
    }
  }, [menu, onClose])

  useEffect(() => {
    if (!menu || !ref.current) return
    const el = ref.current
    const rect = el.getBoundingClientRect()
    let { x, y } = menu
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8
    if (x !== menu.x || y !== menu.y) {
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
  }, [menu])

  if (!menu) return null

  return ReactDOM.createPortal(
    <div ref={ref} className="trek-popover-enter" style={{
      position: 'fixed', left: menu.x, top: menu.y, zIndex: 999999,
      background: 'var(--bg-card)', borderRadius: 10, padding: '4px',
      border: '1px solid var(--border-primary)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      minWidth: 160,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
      transformOrigin: 'top left',
    }}>
      {menu.items.filter(Boolean).map((item, i) => {
        if (item.divider) return <div key={i} style={{ height: 1, background: 'var(--border-faint)', margin: '3px 6px' }} />
        return <MenuItemRow key={i} item={item} onClose={onClose} />
      })}
    </div>,
    document.body
  )
}
