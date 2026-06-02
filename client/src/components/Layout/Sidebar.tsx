import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAddonStore } from '../../store/addonStore'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation } from '../../i18n'
import {
  Plane, CalendarDays, Globe, Compass, Settings, Shield, LogOut, Sun, Moon, Map,
  LayoutDashboard, BookOpen
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ADDON_NAV: Record<string, { icon: LucideIcon; labelKey: string }> = {
  vacay:   { icon: CalendarDays, labelKey: 'admin.addons.catalog.vacay.name' },
  atlas:   { icon: Globe,        labelKey: 'admin.addons.catalog.atlas.name' },
  journey: { icon: Compass,      labelKey: 'admin.addons.catalog.journey.name' },
}

export default function Sidebar() {
  const { t } = useTranslation()
  const { settings, updateSetting } = useSettingsStore()
  const darkMode = settings.dark_mode
  const dark = darkMode === true || darkMode === 'dark' || (darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const addons = useAddonStore(s => s.addons)
  const globalAddons = addons.filter(a => a.type === 'global' && a.enabled)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showConfirmLogout, setShowConfirmLogout] = useState(false)

  const toggleDarkMode = () => {
    document.documentElement.classList.add('trek-theme-transitioning')
    updateSetting('dark_mode', dark ? 'light' : 'dark').catch(() => {})
    setTimeout(() => document.documentElement.classList.remove('trek-theme-transitioning'), 360)
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { state: { noRedirect: true } })
  }

  const navItems: { to: string; label: string; icon: LucideIcon }[] = [
    { to: '/dashboard', label: t('nav.myTrips'), icon: LayoutDashboard },
    ...globalAddons.flatMap(addon => {
      const nav = ADDON_NAV[addon.id]
      return nav ? [{ to: `/${addon.id}`, label: t(nav.labelKey), icon: nav.icon }] : []
    }),
  ]

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 z-[200]"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-faint)',
        boxShadow: 'var(--sidebar-shadow)',
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f87060 0%, #ffb4a9 100%)' }}
          >
            <Map size={16} color="white" strokeWidth={2.5} />
          </div>
          <span
            className="text-[18px] font-bold tracking-tight"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-system)' }}
          >
            Wndrly
          </span>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = isActive(to)
            return (
              <NavLink
                key={to}
                to={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  color: active ? '#f87060' : 'var(--text-muted)',
                  background: active
                    ? dark ? 'rgba(248,112,96,0.12)' : 'rgba(248,112,96,0.08)'
                    : 'transparent',
                  borderRight: active ? '2px solid #f87060' : '2px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </NavLink>
            )
          })}

          {/* Trips link if dashboard is the only item */}
          {navItems.length <= 1 && (
            <NavLink
              to="/trips"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                color: isActive('/trips') ? '#f87060' : 'var(--text-muted)',
                background: isActive('/trips')
                  ? dark ? 'rgba(248,112,96,0.12)' : 'rgba(248,112,96,0.08)'
                  : 'transparent',
                borderRight: isActive('/trips') ? '2px solid #f87060' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive('/trips')) {
                  e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive('/trips')) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }
              }}
            >
              <Plane size={18} strokeWidth={2} />
              <span>{t('nav.myTrips')}</span>
            </NavLink>
          )}
        </div>

        {/* Divider */}
        <div className="mt-4 mb-3 mx-1 h-px" style={{ background: 'var(--border-faint)' }} />

        {/* Settings */}
        <div className="space-y-0.5">
          <NavLink
            to="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              color: isActive('/settings') ? '#f87060' : 'var(--text-muted)',
              background: isActive('/settings')
                ? dark ? 'rgba(248,112,96,0.12)' : 'rgba(248,112,96,0.08)'
                : 'transparent',
              borderRight: isActive('/settings') ? '2px solid #f87060' : '2px solid transparent',
            }}
            onMouseEnter={e => {
              if (!isActive('/settings')) {
                e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={e => {
              if (!isActive('/settings')) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }
            }}
          >
            <Settings size={18} strokeWidth={2} />
            <span>{t('nav.settings')}</span>
          </NavLink>

          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                color: isActive('/admin') ? '#f87060' : 'var(--text-muted)',
                background: isActive('/admin')
                  ? dark ? 'rgba(248,112,96,0.12)' : 'rgba(248,112,96,0.08)'
                  : 'transparent',
                borderRight: isActive('/admin') ? '2px solid #f87060' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive('/admin')) {
                  e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive('/admin')) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }
              }}
            >
              <Shield size={18} strokeWidth={2} />
              <span>{t('nav.admin')}</span>
            </NavLink>
          )}
        </div>
      </nav>

      {/* User profile card at bottom */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2">
        <div
          className="rounded-2xl px-3 py-3"
          style={{
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(248,112,96,0.06)',
            border: '1px solid var(--border-faint)',
          }}
        >
          <div className="flex items-center gap-2.5">
            {/* Avatar */}
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #f87060 0%, #ffb4a9 100%)',
                  color: 'white',
                }}
              >
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {user?.username}
              </p>
              <p
                className="text-[11px] truncate"
                style={{ color: 'var(--text-faint)' }}
              >
                {user?.email}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                title={dark ? t('nav.lightMode') : t('nav.darkMode')}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {dark ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                title={t('nav.logout')}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-faint)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                  e.currentTarget.style.color = '#ef4444'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-faint)'
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
