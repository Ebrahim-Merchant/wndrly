import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Clock, Navigation2, Car, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import PlaceAvatar from '../shared/PlaceAvatar'
import { getCached, fetchPhoto, onPhotoLoaded } from '../../services/photoService'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { formatTime, formatDate } from '../../utils/formatters'
import { parseTimeToMinutes } from '../../utils/dayMerge'
import type { Day, Place, Assignment, AssignmentsMap, Category } from '../../types'

interface TimelineViewProps {
  tripId: string | undefined
  days: Day[]
  places: Place[]
  categories: Category[]
  assignments: AssignmentsMap
  selectedDayId: number | null
  onSelectDay: (dayId: number, skipFit?: boolean) => void
  onPlaceClick: (placeId: number, assignmentId?: number) => void
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

interface ActivityCardProps {
  assignment: Assignment
  startTime: string | null
  endTime: string | null
  categories: Category[]
  onClick: () => void
  isSelected: boolean
  highlight?: boolean
}

function ActivityCard({ assignment, startTime, endTime, categories, onClick, isSelected, highlight }: ActivityCardProps) {
  const place = assignment.place
  const placesPhotosEnabled = useAuthStore(s => s.placesPhotosEnabled)
  const [photoSrc, setPhotoSrc] = useState<string | null>(place.image_url || null)

  useEffect(() => {
    if (place.image_url) { setPhotoSrc(place.image_url); return }
    if (!placesPhotosEnabled) return
    const photoId = place.google_place_id || place.osm_id
    const cacheKey = photoId || (place.lat && place.lng ? `${place.lat},${place.lng}` : null)
    if (!cacheKey) return
    const cached = getCached(cacheKey)
    if (cached) { setPhotoSrc(cached.photoUrl); return }
    const unsub = onPhotoLoaded(cacheKey, (entry) => setPhotoSrc(entry.photoUrl))
    fetchPhoto(cacheKey, photoId || `coords:${place.lat}:${place.lng}`, place.lat, place.lng, place.name)
    return unsub
  }, [place.id])

  const category = categories.find(c => c.id === place.category_id)
  const durationMins = place.duration_minutes
  const startMins = parseTimeToMinutes(startTime)
  const endMins = parseTimeToMinutes(endTime)
  const displayDuration = durationMins
    ? durationMins
    : (startMins !== null && endMins !== null ? endMins - startMins : null)

  return (
    <div
      id={`place-${assignment.id}`}
      onClick={onClick}
      style={{
        background: highlight ? 'rgba(255, 243, 205, 0.8)' : 'var(--bg-card)',
        borderRadius: 16,
        padding: 14,
        boxShadow: isSelected
          ? '0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,0.12)'
          : highlight
          ? '0 0 0 2px #f59e0b, 0 4px 16px rgba(245,158,11,0.2)'
          : '0 2px 8px rgba(0,0,0,0.07)',
        display: 'flex',
        gap: 12,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s, background 0.3s',
        border: '1px solid var(--border-faint)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = isSelected ? '0 0 0 2px var(--accent), 0 6px 20px rgba(0,0,0,0.15)' : '0 4px 16px rgba(0,0,0,0.12)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isSelected ? '0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,0.12)' : highlight ? '0 0 0 2px #f59e0b, 0 4px 16px rgba(245,158,11,0.2)' : '0 2px 8px rgba(0,0,0,0.07)' }}
    >
      {/* Image */}
      <div style={{ width: 100, height: 100, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-tertiary)', position: 'relative' }}>
        {photoSrc ? (
          <img src={photoSrc} alt={place.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            {place.icon || category?.icon || '📍'}
          </div>
        )}
        {category && (
          <div style={{
            position: 'absolute', bottom: 6, left: 6,
            background: 'rgba(0,0,0,0.6)', color: 'white',
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6,
          }}>
            {category.icon} {category.name}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          {startTime && (
            <span style={{
              background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
              padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Clock size={11} />
              {startTime}
              {endTime && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> → {endTime}</span>}
            </span>
          )}
          {displayDuration !== null && (
            <span style={{
              background: 'rgba(99,102,241,0.12)', color: '#6366f1',
              padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            }}>
              {formatDuration(displayDuration)}
            </span>
          )}
          {place.price && (
            <span style={{
              background: 'rgba(16,185,129,0.12)', color: '#10b981',
              padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              marginLeft: 'auto',
            }}>
              {place.currency || ''}{place.price}
            </span>
          )}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
          {place.name}
        </div>
        {(place.description || place.address) && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {place.description || place.address}
          </div>
        )}
        {assignment.notes && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, fontStyle: 'italic' }}>
            {assignment.notes}
          </div>
        )}
      </div>
    </div>
  )
}

interface TransitGapProps {
  fromPlace: Place
  toPlace: Place
}

function TransitGap({ fromPlace, toPlace }: TransitGapProps) {
  const distance = (fromPlace.lat && fromPlace.lng && toPlace.lat && toPlace.lng)
    ? haversineDistance(fromPlace.lat, fromPlace.lng, toPlace.lat, toPlace.lng)
    : null

  if (!distance) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', marginLeft: 8, color: 'var(--text-faint)', fontSize: 12 }}>
      <div style={{ width: 2, height: 24, background: 'var(--border-primary)', borderRadius: 1 }} />
    </div>
  )

  const walkingMins = Math.round((distance / 5) * 60)
  const drivingMins = Math.round((distance / 40) * 60)
  const distanceText = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 6px 8px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ width: 2, height: 10, background: 'var(--border-primary)', borderRadius: 1 }} />
        <div style={{ width: 2, height: 10, background: 'var(--border-faint)', borderRadius: 1 }} />
        <div style={{ width: 2, height: 10, background: 'var(--border-primary)', borderRadius: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
          <Car size={11} />
          {drivingMins}m drive
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
          🚶 {walkingMins}m walk
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text-faint)', fontWeight: 400 }}>
          <Navigation2 size={10} />
          {distanceText}
        </span>
      </div>
    </div>
  )
}

interface SearchResult {
  assignmentId: number
  dayId: number
  dayNumber: number
  placeName: string
  placeType?: string
  placeIcon?: string
  categoryIcon?: string
  time?: string | null
}

export default function TimelineView({
  tripId,
  days,
  places,
  categories,
  assignments,
  selectedDayId,
  onSelectDay,
  onPlaceClick,
}: TimelineViewProps) {
  const { settings } = useSettingsStore()
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const [activeDayId, setActiveDayId] = useState<number | null>(selectedDayId)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const locale = settings.language || 'en'
  const timeFormat = settings.time_format || '12h'

  // Load collapsed preference
  useEffect(() => {
    const saved = localStorage.getItem('wndrly_timeline_sidebar_collapsed')
    if (saved) setIsCollapsed(saved === 'true')
  }, [])

  useEffect(() => {
    localStorage.setItem('wndrly_timeline_sidebar_collapsed', String(isCollapsed))
  }, [isCollapsed])

  // Sync activeDayId with selectedDayId prop
  useEffect(() => {
    if (selectedDayId !== null) setActiveDayId(selectedDayId)
  }, [selectedDayId])

  // All days sorted assignments
  const allDayAssignments = useMemo(() => {
    return days.map(day => {
      const sorted = [...(assignments[String(day.id)] || [])].sort((a, b) => {
        const aTime = parseTimeToMinutes(a.place?.place_time)
        const bTime = parseTimeToMinutes(b.place?.place_time)
        if (aTime !== null && bTime !== null) return aTime - bTime
        if (aTime !== null) return -1
        if (bTime !== null) return 1
        return a.order_index - b.order_index
      })
      return { day, assignments: sorted }
    })
  }, [days, assignments])

  // Intersection Observer: auto-update active day pill as user scrolls
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          const dayId = parseInt(visible[0].target.id.replace('day-section-', ''), 10)
          if (!isNaN(dayId)) {
            setActiveDayId(dayId)
            onSelectDay(dayId, true)
          }
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.15,
        rootMargin: '-60px 0px 0px 0px',
      }
    )

    days.forEach(day => {
      const el = document.getElementById(`day-section-${day.id}`)
      if (el) observerRef.current!.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [days, scrollContainerRef.current])

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleDayClick = useCallback((dayId: number) => {
    setActiveDayId(dayId)
    onSelectDay(dayId, true)
    const el = document.getElementById(`day-section-${dayId}`)
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [onSelectDay])

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (!q.trim()) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    const lower = q.toLowerCase()
    const results: SearchResult[] = []
    allDayAssignments.forEach(({ day }, idx) => {
      allDayAssignments[idx].assignments.forEach(a => {
        const p = a.place
        if (!p) return
        const cat = categories.find(c => c.id === p.category_id)
        if (
          p.name?.toLowerCase().includes(lower) ||
          p.description?.toLowerCase().includes(lower) ||
          p.address?.toLowerCase().includes(lower) ||
          cat?.name?.toLowerCase().includes(lower)
        ) {
          results.push({
            assignmentId: a.id,
            dayId: day.id,
            dayNumber: days.indexOf(day) + 1,
            placeName: p.name,
            placeIcon: p.icon,
            categoryIcon: cat?.icon,
            time: p.place_time ? formatTime(p.place_time, locale, timeFormat) : null,
          })
        }
      })
    })
    setSearchResults(results)
    setSearchOpen(results.length > 0)
  }, [allDayAssignments, categories, days, locale, timeFormat])

  const handleResultClick = useCallback((result: SearchResult) => {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])

    // Jump to the day section
    handleDayClick(result.dayId)

    // Highlight the specific card after a short delay for scroll
    setTimeout(() => {
      const el = document.getElementById(`place-${result.assignmentId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightedAssignmentId(result.assignmentId)
        setTimeout(() => setHighlightedAssignmentId(null), 2500)
      }
    }, 400)
  }, [handleDayClick])

  if (days.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        No days in this trip yet
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Collapse toggle button */}
      <button
        onClick={() => setIsCollapsed(v => !v)}
        title={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
        style={{
          position: 'absolute',
          top: 10,
          right: isCollapsed ? 6 : 10,
          zIndex: 30,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-faint)',
          borderRadius: 8,
          padding: '5px 7px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
          color: 'var(--text-muted)',
        }}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {isCollapsed ? (
        /* ── COLLAPSED ICON-ONLY MODE ── */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          padding: '44px 6px 16px',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}>
          {days.map((day, idx) => {
            const isActive = day.id === activeDayId
            return (
              <button
                key={day.id}
                onClick={() => handleDayClick(day.id)}
                title={`Day ${idx + 1}${day.title ? ': ' + day.title : ''}`}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: isActive ? '2px solid var(--accent)' : '2px solid var(--border-primary)',
                  background: isActive ? 'var(--accent)' : 'var(--bg-card)',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>
      ) : (
        /* ── EXPANDED FULL MODE ── */
        <>
          {/* Search bar */}
          <div ref={searchRef} style={{ position: 'relative', padding: '10px 44px 0 12px', flexShrink: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border-faint)',
              borderRadius: 12,
              padding: '7px 10px',
              gap: 8,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
              onFocus={() => searchQuery && setSearchOpen(searchResults.length > 0)}
            >
              <Search size={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search places…"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => searchQuery && setSearchOpen(searchResults.length > 0)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-faint)', display: 'flex' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {searchOpen && searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 12,
                right: 44,
                marginTop: 4,
                background: 'var(--bg-card)',
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                maxHeight: 320,
                overflowY: 'auto',
                zIndex: 100,
                border: '1px solid var(--border-faint)',
              }}>
                {searchResults.map(result => (
                  <button
                    key={`${result.dayId}-${result.assignmentId}`}
                    onClick={() => handleResultClick(result)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 14px',
                      border: 'none',
                      borderBottom: '1px solid var(--border-faint)',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>
                      {result.placeIcon || result.categoryIcon || '📍'}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {result.placeName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        Day {result.dayNumber}{result.time ? ` · ${result.time}` : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Day pills */}
          <div style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            padding: '8px 12px 8px',
            borderBottom: '1px solid var(--border-faint)',
            flexShrink: 0,
            scrollbarWidth: 'none',
          }}>
            {days.map((day, idx) => {
              const isActive = day.id === activeDayId
              return (
                <button
                  key={day.id}
                  onClick={() => handleDayClick(day.id)}
                  style={{
                    flexShrink: 0,
                    padding: '5px 13px',
                    borderRadius: 20,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 400,
                    background: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  Day {idx + 1}
                  {day.date && (
                    <span style={{ opacity: 0.7, marginLeft: 4, fontWeight: 400 }}>
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Continuous scrollable timeline */}
          <div
            ref={scrollContainerRef}
            style={{ flex: 1, overflowY: 'auto', scrollBehavior: 'smooth', scrollbarWidth: 'thin' }}
          >
            {allDayAssignments.map(({ day, assignments: dayAssignments }, dayIdx) => {
              const dayNumber = dayIdx + 1

              // Day stats
              const dayBudget = dayAssignments.reduce((sum, a) => {
                const price = parseFloat(a.place?.price || '0')
                return sum + (isNaN(price) ? 0 : price)
              }, 0)
              let totalTransitMins = 0
              for (let i = 0; i < dayAssignments.length - 1; i++) {
                const a = dayAssignments[i].place
                const b = dayAssignments[i + 1].place
                if (a?.lat && a?.lng && b?.lat && b?.lng) {
                  totalTransitMins += Math.round((haversineDistance(a.lat, a.lng, b.lat, b.lng) / 40) * 60)
                }
              }

              return (
                <div
                  key={day.id}
                  id={`day-section-${day.id}`}
                  style={{ scrollMarginTop: 8 }}
                >
                  {/* Sticky day header */}
                  <div style={{
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-primary)',
                    zIndex: 10,
                    padding: '12px 16px 10px',
                    borderBottom: '2px solid var(--border-faint)',
                    marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Day {dayNumber}{day.title ? ` · ${day.title}` : ''}
                      </h2>
                      {day.date && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    {dayAssignments.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ background: 'var(--bg-tertiary)', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
                          📅 {dayAssignments.length} {dayAssignments.length === 1 ? 'stop' : 'stops'}
                        </span>
                        {totalTransitMins > 0 && (
                          <span style={{ background: 'rgba(99,102,241,0.1)', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: '#6366f1' }}>
                            🚗 {formatDuration(totalTransitMins)}
                          </span>
                        )}
                        {dayBudget > 0 && (
                          <span style={{ background: 'rgba(16,185,129,0.1)', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: '#10b981' }}>
                            💰 ${dayBudget.toFixed(0)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Activity cards */}
                  <div style={{ padding: '0 16px 0' }}>
                    {dayAssignments.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px', color: 'var(--text-faint)', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>No activities yet</div>
                        <div style={{ fontSize: 12 }}>Add places to this day from the Places panel</div>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        {/* Vertical timeline line */}
                        <div style={{
                          position: 'absolute', left: 32, top: 8, bottom: 8, width: 2,
                          background: 'linear-gradient(to bottom, var(--accent), var(--border-faint))',
                          borderRadius: 1, opacity: 0.4, pointerEvents: 'none',
                        }} />

                        {dayAssignments.map((assignment, idx) => {
                          const place = assignment.place
                          if (!place) return null
                          const startTime = place.place_time ? formatTime(place.place_time, locale, timeFormat) : null
                          const endTime = place.end_time ? formatTime(place.end_time, locale, timeFormat) : null
                          const isSelected = assignment.id === selectedAssignmentId
                          const isHighlighted = assignment.id === highlightedAssignmentId

                          return (
                            <div key={assignment.id}>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <div style={{ width: 66, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                                  {startTime ? (
                                    <>
                                      <div style={{
                                        width: 10, height: 10, borderRadius: '50%',
                                        background: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                                        border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-primary)'}`,
                                        zIndex: 1, flexShrink: 0,
                                        boxShadow: isSelected ? '0 0 0 3px rgba(var(--accent-rgb),0.2)' : 'none',
                                      }} />
                                      <div style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 600, marginTop: 4, textAlign: 'center', lineHeight: 1.2, maxWidth: 54 }}>
                                        {startTime}
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{
                                      width: 8, height: 8, borderRadius: '50%',
                                      background: 'var(--bg-tertiary)', border: '2px solid var(--border-primary)',
                                      zIndex: 1, marginTop: 2,
                                    }} />
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <ActivityCard
                                    assignment={assignment}
                                    startTime={startTime}
                                    endTime={endTime}
                                    categories={categories}
                                    onClick={() => {
                                      setSelectedAssignmentId(isSelected ? null : assignment.id)
                                      onPlaceClick(place.id, assignment.id)
                                    }}
                                    isSelected={isSelected}
                                    highlight={isHighlighted}
                                  />
                                </div>
                              </div>
                              {idx < dayAssignments.length - 1 && dayAssignments[idx + 1].place && (
                                <div style={{ paddingLeft: 78 }}>
                                  <TransitGap fromPlace={place} toPlace={dayAssignments[idx + 1].place} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Day separator */}
                  {dayIdx < allDayAssignments.length - 1 && (
                    <div style={{
                      height: 1,
                      margin: '24px 20px 0',
                      background: 'linear-gradient(to right, transparent, var(--border-faint), transparent)',
                    }} />
                  )}
                  <div style={{ height: 32 }} />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
