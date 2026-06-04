import React, { useEffect, useState } from 'react'
import { Calendar, Clock, RefreshCw, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { daysApi } from '../../../api/client'
import LiquidGlass from '../LiquidGlass'

interface Place {
  id: number
  name: string
  category?: { name: string; icon?: string; color?: string }
  lat?: number
  lng?: number
}

interface Assignment {
  id: number
  place_id: number
  start_time?: string | null
  end_time?: string | null
  place?: Place
}

interface Day {
  id: number
  date?: string | null
  title?: string | null
  assignments: Assignment[]
}

interface UpcomingActivitiesWidgetProps {
  tripId: number
  dark?: boolean
  onViewDay?: (dayId: number) => void
}

const STORAGE_KEY = 'widget_upcoming_collapsed'
const DEFAULT_LIMIT = 5

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${m} ${ampm}`
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function getDayLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  return formatDate(dateStr) || ''
}

function getDayBadgeStyle(dateStr: string | null | undefined): React.CSSProperties {
  if (!dateStr) return {}
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (dateStr === today) return { background: '#34d39922', color: '#34d399' }
  if (dateStr === tomorrow) return { background: '#60a5fa22', color: '#60a5fa' }
  return { background: 'var(--bg-tertiary)', color: 'var(--text-faint)' }
}

export default function UpcomingActivitiesWidget({ tripId, dark = false, onViewDay }: UpcomingActivitiesWidgetProps) {
  const [days, setDays] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
  }

  const fetchDays = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await daysApi.list(tripId)
      setDays(data.days || data || [])
    } catch {
      setError('Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDays() }, [tripId])

  const today = new Date().toISOString().split('T')[0]
  const allUpcoming: Array<{ day: Day; assignment: Assignment }> = []

  const sortedDays = [...days].sort((a, b) => {
    const da = a.date || '', db = b.date || ''
    return da.localeCompare(db)
  })

  for (const day of sortedDays) {
    if (day.date && day.date < today) continue
    for (const assignment of (day.assignments || [])) {
      allUpcoming.push({ day, assignment })
    }
  }

  const upcoming = showAll ? allUpcoming : allUpcoming.slice(0, DEFAULT_LIMIT)
  const hasMore = allUpcoming.length > DEFAULT_LIMIT

  return (
    <LiquidGlass
      dark={dark}
      style={{ borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="w-1.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #818cf8 0%, #a5b4fc 100%)' }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>📅 Upcoming</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {!collapsed && allUpcoming.length > 0 && (
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-faint)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 6 }}>
                {allUpcoming.length}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); fetchDays() }}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-faint)' }}
              title="Refresh"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleCollapsed() }}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-faint)' }}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Collapsible content */}
        <div style={{
          overflow: 'hidden',
          maxHeight: collapsed ? 0 : 800,
          opacity: collapsed ? 0 : 1,
          transition: 'max-height 0.35s ease, opacity 0.2s ease',
        }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <div className="trek-skeleton rounded-xl" style={{ width: 38, height: 38, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="trek-skeleton" style={{ height: 13, borderRadius: 4, width: '70%' }} />
                    <div className="trek-skeleton" style={{ height: 11, borderRadius: 4, width: '50%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && (error || upcoming.length === 0) && (
            <div className="text-center" style={{ padding: '16px 0' }}>
              <Calendar size={20} className="mx-auto mb-1.5 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                {upcoming.length === 0 ? 'No upcoming activities' : 'Failed to load'}
              </p>
            </div>
          )}

          {!loading && !error && upcoming.length > 0 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.map(({ day, assignment }) => {
                  const place = assignment.place
                  const catColor = place?.category?.color || 'var(--text-faint)'
                  const catIcon = place?.category?.icon || '📍'
                  const dayLabel = getDayLabel(day.date)
                  const timeStr = formatTime(assignment.start_time)
                  const badgeStyle = getDayBadgeStyle(day.date)

                  return (
                    <div
                      key={assignment.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 10px',
                        borderRadius: 12,
                        background: 'var(--bg-secondary)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onClick={() => onViewDay?.(day.id)}
                    >
                      {/* Icon bubble */}
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 11,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          flexShrink: 0,
                          background: `${catColor}22`,
                        }}
                      >
                        {catIcon}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          className="text-[13px] font-semibold leading-tight truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {place?.name || 'Activity'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                          {dayLabel && (
                            <span
                              className="text-[10px] font-semibold"
                              style={{
                                ...badgeStyle,
                                padding: '1px 6px',
                                borderRadius: 5,
                              }}
                            >
                              {dayLabel}
                            </span>
                          )}
                          {timeStr && (
                            <span
                              style={{ display: 'flex', alignItems: 'center', gap: 3 }}
                              className="text-[10px]"
                            >
                              <Clock size={9} style={{ color: 'var(--text-faint)' }} />
                              <span style={{ color: 'var(--text-faint)' }}>{timeStr}</span>
                            </span>
                          )}
                          {place?.category?.name && (
                            <span
                              className="text-[10px] truncate"
                              style={{ color: 'var(--text-faint)', maxWidth: 90 }}
                            >
                              {place.category.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                    </div>
                  )
                })}
              </div>

              {/* View all / Show less */}
              {hasMore && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    padding: '8px',
                    borderRadius: 10,
                    background: 'var(--bg-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-faint)',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    transition: 'background 0.15s ease',
                  }}
                >
                  {showAll ? (
                    <>Show less <ChevronUp size={12} /></>
                  ) : (
                    <>View all {allUpcoming.length} activities <ChevronRight size={12} /></>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </LiquidGlass>
  )
}
