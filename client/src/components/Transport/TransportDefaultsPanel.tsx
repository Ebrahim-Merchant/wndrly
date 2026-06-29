/**
 * TransportDefaultsPanel.tsx
 * UI panel for managing transit-first transport defaults at trip, city, and day level.
 * Shown inside trip settings (TripFormModal / Settings panel).
 */

import { useState, useEffect } from 'react'
import { Bus, Car, Bike, Ship, Train, Plane, Navigation, Plus, Trash2, ChevronDown } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useToast } from '../shared/Toast'
import { transitApi } from '../../api/client'
import type { TransportMode, CityTransport, Day } from '../../types'
import { TRANSPORT_MODE_OPTIONS } from '../../types'

// ─── Icon map ────────────────────────────────────────────────────────────────

function ModeIcon({ mode, size = 14 }: { mode: string; size?: number }) {
  switch (mode) {
    case 'walking+transit': return <Bus size={size} />
    case 'walking':         return <Navigation size={size} />
    case 'car':             return <Car size={size} />
    case 'taxi':            return <Car size={size} />
    case 'bike':            return <Bike size={size} />
    case 'boat':            return <Ship size={size} />
    case 'train':           return <Train size={size} />
    case 'bus':             return <Bus size={size} />
    case 'plane':           return <Plane size={size} />
    default:                return <Navigation size={size} />
  }
}

// ─── Mode selector pill ───────────────────────────────────────────────────────

interface ModeSelectorProps {
  value: string
  onChange: (mode: TransportMode) => void
  compact?: boolean
}

export function TransportModeSelector({ value, onChange, compact = false }: ModeSelectorProps) {
  const [open, setOpen] = useState(false)
  const selected = TRANSPORT_MODE_OPTIONS.find(o => o.value === value) || TRANSPORT_MODE_OPTIONS[0]

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: compact ? '4px 8px' : '6px 12px',
          borderRadius: 10, border: '1px solid var(--border-primary)',
          background: 'var(--bg-card)', cursor: 'pointer',
          fontSize: compact ? 11 : 12, fontWeight: 500, fontFamily: 'inherit',
          color: 'var(--text-primary)',
        }}
      >
        <ModeIcon mode={value} size={compact ? 12 : 14} />
        <span>{selected.icon} {selected.label}</span>
        <ChevronDown size={compact ? 10 : 12} style={{ color: 'var(--text-faint)', marginLeft: 2 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
            background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
            borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: 4, minWidth: 200,
          }}
        >
          {TRANSPORT_MODE_OPTIONS.filter(o => o.value !== 'boat' && o.value !== 'plane').map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 10px', background: option.value === value ? 'var(--accent)' : 'none',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
                color: option.value === value ? 'var(--accent-text)' : 'var(--text-primary)',
              }}
              onMouseEnter={e => { if (option.value !== value) (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)' }}
              onMouseLeave={e => { if (option.value !== value) (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              <ModeIcon mode={option.value} size={13} />
              <span>{option.icon}</span>
              <span style={{ flex: 1 }}>{option.label}</span>
              {option.speed < 50 && (
                <span style={{ fontSize: 10, color: option.value === value ? 'rgba(255,255,255,0.7)' : 'var(--text-faint)' }}>
                  ~{option.speed} km/h
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface TransportDefaultsPanelProps {
  tripId: number | string
  days: Day[]
  compact?: boolean
}

export function TransportDefaultsPanel({ tripId, days, compact = false }: TransportDefaultsPanelProps) {
  const { t } = useTranslation()
  const toast = useToast()

  const [tripDefault, setTripDefault] = useState<string>('walking+transit')
  const [cityOverrides, setCityOverrides] = useState<CityTransport[]>([])
  const [dayOverrides, setDayOverrides] = useState<Record<number, string | null>>({})
  const [loading, setLoading] = useState(true)

  const [newCityLabel, setNewCityLabel] = useState('')
  const [newCityMode, setNewCityMode] = useState<TransportMode>('walking+transit')
  const [showCityAdd, setShowCityAdd] = useState(false)
  const [showDays, setShowDays] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      transitApi.getTripDefaults(tripId),
      transitApi.getCityTransport(tripId),
    ]).then(([defaults, cities]) => {
      setTripDefault(defaults.default_transport_mode || 'walking+transit')
      setCityOverrides(cities)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [tripId])

  const handleTripDefaultChange = async (mode: TransportMode) => {
    const prev = tripDefault
    setTripDefault(mode)
    try {
      await transitApi.patchTripDefaults(tripId, mode)
      toast.success('Trip transport default updated')
    } catch {
      setTripDefault(prev)
      toast.error('Failed to update transport default')
    }
  }

  const handleDayOverrideChange = async (dayId: number, mode: string | null) => {
    const prev = dayOverrides[dayId]
    setDayOverrides(prev => ({ ...prev, [dayId]: mode }))
    try {
      await transitApi.patchDayTransport(tripId, dayId, mode)
    } catch {
      setDayOverrides(prev => ({ ...prev, [dayId]: prev ?? null }))
      toast.error('Failed to update day transport')
    }
  }

  const handleAddCityOverride = async () => {
    if (!newCityLabel.trim()) return
    const label = newCityLabel.trim()
    try {
      const row = await transitApi.putCityTransport(tripId, label, newCityMode)
      setCityOverrides(prev => {
        const idx = prev.findIndex(c => c.city_label === label)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], transport_mode: row.transport_mode }
          return updated
        }
        return [...prev, { id: Date.now(), city_label: label, transport_mode: row.transport_mode }]
      })
      setNewCityLabel('')
      setShowCityAdd(false)
      toast.success(`City override added: ${label}`)
    } catch {
      toast.error('Failed to add city override')
    }
  }

  const handleDeleteCity = async (label: string) => {
    try {
      await transitApi.deleteCityTransport(tripId, label)
      setCityOverrides(prev => prev.filter(c => c.city_label !== label))
    } catch {
      toast.error('Failed to remove city override')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '12px 0', color: 'var(--text-faint)', fontSize: 12 }}>
        Loading transport settings…
      </div>
    )
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em',
  }
  const sectionStyle: React.CSSProperties = {
    padding: '14px 0',
    borderBottom: '1px solid var(--border-faint)',
  }

  return (
    <div style={{ fontSize: 13 }}>

      {/* Trip-level default */}
      <div style={sectionStyle}>
        <label style={labelStyle}>🌍 Trip default transport mode</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <TransportModeSelector value={tripDefault} onChange={handleTripDefaultChange} />
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            Used for all city/day route estimates unless overridden
          </span>
        </div>
        {tripDefault === 'walking+transit' && (
          <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, fontSize: 11, color: '#6366f1' }}>
            🚇 Transit routes use Google Routes API when a Maps key is configured.
            Results are cached for 6–24h to minimize API usage.
          </div>
        )}
      </div>

      {/* City-level overrides */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>🏙️ City / region overrides</label>
          <button
            type="button"
            onClick={() => setShowCityAdd(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 8, border: '1px solid var(--border-primary)',
              background: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
              color: 'var(--text-muted)',
            }}
          >
            <Plus size={11} /> Add
          </button>
        </div>

        {showCityAdd && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={newCityLabel}
              onChange={e => setNewCityLabel(e.target.value)}
              placeholder="e.g. London, Countryside, Day trips"
              style={{
                flex: 1, minWidth: 140,
                border: '1px solid var(--border-primary)', borderRadius: 8,
                padding: '6px 10px', fontSize: 12, fontFamily: 'inherit',
                background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none',
              }}
              onKeyDown={e => e.key === 'Enter' && handleAddCityOverride()}
            />
            <TransportModeSelector value={newCityMode} onChange={setNewCityMode} compact />
            <button
              type="button"
              onClick={handleAddCityOverride}
              disabled={!newCityLabel.trim()}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: 'var(--accent-text)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                opacity: !newCityLabel.trim() ? 0.5 : 1,
              }}
            >
              Save
            </button>
          </div>
        )}

        {cityOverrides.length === 0 && !showCityAdd && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
            No city overrides yet. Useful for multi-city trips where one city uses transit and another uses a rental car.
          </div>
        )}

        {cityOverrides.map(city => (
          <div key={city.city_label} style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
            padding: '7px 10px', background: 'var(--bg-secondary)', borderRadius: 8,
          }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
              {city.city_label}
            </span>
            <TransportModeSelector
              value={city.transport_mode}
              compact
              onChange={async (mode) => {
                try {
                  await transitApi.putCityTransport(tripId, city.city_label, mode)
                  setCityOverrides(prev => prev.map(c => c.city_label === city.city_label ? { ...c, transport_mode: mode } : c))
                } catch {
                  toast.error('Failed to update')
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleDeleteCity(city.city_label)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', padding: 4 }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Day-level overrides (collapsed by default) */}
      {days.length > 0 && (
        <div style={{ padding: '14px 0' }}>
          <button
            type="button"
            onClick={() => setShowDays(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit', color: 'var(--text-muted)', padding: 0, marginBottom: showDays ? 10 : 0,
            }}
          >
            <ChevronDown size={13} style={{ transition: 'transform 0.15s', transform: showDays ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              📅 Per-day overrides ({days.filter(d => dayOverrides[d.id]).length} set)
            </span>
          </button>

          {showDays && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {days.map(day => {
                const override = dayOverrides[day.id]
                return (
                  <div key={day.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', background: override ? 'var(--bg-secondary)' : 'transparent',
                    borderRadius: 8, border: override ? '1px solid var(--border-faint)' : '1px solid transparent',
                  }}>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)' }}>
                      Day {day.day_number}{day.title ? ` — ${day.title}` : ''}{day.date ? ` (${day.date})` : ''}
                    </span>
                    <TransportModeSelector
                      value={override || tripDefault}
                      compact
                      onChange={(mode) => handleDayOverrideChange(day.id, mode)}
                    />
                    {override && (
                      <button
                        type="button"
                        onClick={() => handleDayOverrideChange(day.id, null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', padding: 2 }}
                        title="Reset to trip default"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TransportDefaultsPanel
