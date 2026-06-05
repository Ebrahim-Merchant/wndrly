import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Clock, Navigation2, Car, Search, X, ChevronLeft, ChevronRight, GripVertical, Zap, Check, Pencil, Plane, Train, Bike, Ship, Bus, PersonStanding } from 'lucide-react'
import PlaceAvatar from '../shared/PlaceAvatar'
import { getCached, fetchPhoto, onPhotoLoaded } from '../../services/photoService'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { formatTime, formatDate } from '../../utils/formatters'
import { parseTimeToMinutes } from '../../utils/dayMerge'
import type { Day, Place, Assignment, AssignmentsMap, Category } from '../../types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { assignmentsApi, weatherApi, placesApi } from '../../api/client'

interface TimelineViewProps {
  tripId: string | undefined
  days: Day[]
  places: Place[]
  categories: Category[]
  assignments: AssignmentsMap
  selectedDayId: number | null
  onSelectDay: (dayId: number, skipFit?: boolean) => void
  onPlaceClick: (placeId: number, assignmentId?: number) => void
  onReorderDay?: (dayId: number, orderedIds: number[]) => void
}

// ─── Transport Mode Config ───────────────────────────────────────────────────
const TRANSPORT_MODES = [
  { id: 'car',    label: 'Car',       icon: '🚗', speed: 40  },
  { id: 'walk',   label: 'Walk',      icon: '🚶', speed: 5   },
  { id: 'bike',   label: 'Bike',      icon: '🚲', speed: 15  },
  { id: 'train',  label: 'Train',     icon: '🚆', speed: 80  },
  { id: 'bus',    label: 'Bus',       icon: '🚌', speed: 25  },
  { id: 'plane',  label: 'Plane',     icon: '✈️', speed: 600 },
  { id: 'boat',   label: 'Boat/Ferry',icon: '⛴️', speed: 30  },
] as const
type TransportMode = typeof TRANSPORT_MODES[number]['id']

function getTransportSpeed(mode: string | null): number {
  const m = TRANSPORT_MODES.find(t => t.id === mode)
  return m ? m.speed : 40
}

// ─── Weather Types ───────────────────────────────────────────────────────────
interface DayWeather {
  temp: number
  description: string
  main: string
  emoji: string
  wind_max?: number
  precip?: number
}

function weatherMainToEmoji(main: string): string {
  const m = main?.toLowerCase() || ''
  if (m.includes('clear'))       return '☀️'
  if (m.includes('cloud'))       return '⛅'
  if (m.includes('rain') || m.includes('drizzle')) return '🌧️'
  if (m.includes('snow'))        return '❄️'
  if (m.includes('thunder') || m.includes('storm')) return '⚡'
  if (m.includes('fog') || m.includes('mist'))      return '🌫️'
  return '🌤️'
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
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

function ActivityCard({ assignment, startTime, endTime, categories, onClick, isSelected, highlight, isDragging, dragHandleProps }: ActivityCardProps) {
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
        boxShadow: isDragging
          ? '0 12px 40px rgba(0,0,0,0.25)'
          : isSelected
          ? '0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,0.12)'
          : highlight
          ? '0 0 0 2px #f59e0b, 0 4px 16px rgba(245,158,11,0.2)'
          : '0 2px 8px rgba(0,0,0,0.07)',
        display: 'flex',
        gap: 12,
        cursor: 'pointer',
        transition: isDragging ? 'none' : 'box-shadow 0.15s, transform 0.15s, background 0.3s',
        border: '1px solid var(--border-faint)',
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = isSelected ? '0 0 0 2px var(--accent), 0 6px 20px rgba(0,0,0,0.15)' : '0 4px 16px rgba(0,0,0,0.12)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = isSelected ? '0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,0.12)' : highlight ? '0 0 0 2px #f59e0b, 0 4px 16px rgba(245,158,11,0.2)' : '0 2px 8px rgba(0,0,0,0.07)' }}
    >
      {/* Drag Handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '4px 3px',
            cursor: 'grab',
            color: 'var(--text-faint)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            opacity: 0.5,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)' }}
        >
          <GripVertical size={16} />
        </div>
      )}
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
  transportMode?: string | null
  onEditTransport?: (mode: string) => void
}

function TransitGap({ fromPlace, toPlace, transportMode, onEditTransport }: TransitGapProps) {
  const [showEditor, setShowEditor] = useState(false)
  const [hovering, setHovering] = useState(false)
  const currentMode = transportMode || 'car'
  const speed = getTransportSpeed(currentMode)

  const distance = (fromPlace.lat && fromPlace.lng && toPlace.lat && toPlace.lng)
    ? haversineDistance(fromPlace.lat, fromPlace.lng, toPlace.lat, toPlace.lng)
    : null

  const travelMins = distance ? Math.max(1, Math.round((distance / speed) * 60)) : null
  const distanceText = distance
    ? (distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`)
    : null

  const modeInfo = TRANSPORT_MODES.find(t => t.id === currentMode) || TRANSPORT_MODES[0]

  if (!distance) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', marginLeft: 8, color: 'var(--text-faint)', fontSize: 12 }}>
      <div style={{ width: 2, height: 24, background: 'var(--border-primary)', borderRadius: 1 }} />
    </div>
  )

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 6px 8px', cursor: onEditTransport ? 'pointer' : 'default' }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => { setHovering(false) }}
        onClick={() => onEditTransport && setShowEditor(v => !v)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 2, height: 10, background: 'var(--border-primary)', borderRadius: 1 }} />
          <div style={{ width: 2, height: 10, background: 'var(--border-faint)', borderRadius: 1 }} />
          <div style={{ width: 2, height: 10, background: 'var(--border-primary)', borderRadius: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: hovering && onEditTransport ? 'rgba(99,102,241,0.12)' : 'var(--bg-tertiary)',
            border: hovering && onEditTransport ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
            padding: '4px 10px', borderRadius: 20, fontSize: 11, color: hovering && onEditTransport ? '#6366f1' : 'var(--text-muted)', fontWeight: 500,
            transition: 'all 0.15s',
          }}>
            {modeInfo.icon} {travelMins}m by {modeInfo.label.toLowerCase()}
            {onEditTransport && hovering && <Pencil size={9} style={{ marginLeft: 2 }} />}
          </span>
          {distanceText && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text-faint)', fontWeight: 400 }}>
              <Navigation2 size={10} />
              {distanceText}
            </span>
          )}
        </div>
      </div>

      {/* Transport Mode Editor Popup */}
      {showEditor && onEditTransport && (
        <div style={{
          position: 'absolute',
          left: 30,
          top: '100%',
          zIndex: 50,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-faint)',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          padding: 10,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          maxWidth: 240,
        }}>
          <div style={{ width: '100%', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transport mode</div>
          {TRANSPORT_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={e => { e.stopPropagation(); onEditTransport(mode.id); setShowEditor(false) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer',
                border: currentMode === mode.id ? '2px solid var(--accent)' : '1px solid var(--border-faint)',
                background: currentMode === mode.id ? 'rgba(99,102,241,0.12)' : 'var(--bg-tertiary)',
                color: currentMode === mode.id ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'all 0.12s',
              }}
            >
              {mode.icon} {mode.label}
            </button>
          ))}
          <button
            onClick={e => { e.stopPropagation(); setShowEditor(false) }}
            style={{ width: '100%', marginTop: 4, padding: '4px 10px', borderRadius: 8, border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
        </div>
      )}
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

// ─── SortableActivityItem: wraps ActivityCard with DnD sortable ────────────────
interface SortableActivityItemProps {
  assignment: Assignment
  startTime: string | null
  endTime: string | null
  categories: Category[]
  onClick: () => void
  isSelected: boolean
  highlight: boolean
  activeId: number | null
}
function SortableActivityItem({ assignment, startTime, endTime, categories, onClick, isSelected, highlight, activeId }: SortableActivityItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: assignment.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <ActivityCard
        assignment={assignment}
        startTime={startTime}
        endTime={endTime}
        categories={categories}
        onClick={onClick}
        isSelected={isSelected}
        highlight={highlight}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ─── WeatherBadge ───────────────────────────────────────────────────────────────
function WeatherBadge({ weather }: { weather: DayWeather | null | undefined }) {
  if (!weather) return null
  return (
    <span
      title={`${weather.description}${weather.wind_max ? `, wind ${weather.wind_max}km/h` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'rgba(59,130,246,0.1)', padding: '3px 9px', borderRadius: 20,
        fontSize: 11, fontWeight: 600, color: '#3b82f6',
        cursor: 'default',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 14 }}>{weather.emoji}</span>
      {Math.round(weather.temp)}°
    </span>
  )
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
  onReorderDay,
}: TimelineViewProps) {
  const { settings } = useSettingsStore()
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const [activeDayId, setActiveDayId] = useState<number | null>(selectedDayId)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState<number | null>(null)
  // DnD state
  const [activeAssignmentId, setActiveAssignmentId] = useState<number | null>(null)
  const [localOrders, setLocalOrders] = useState<Record<number, Assignment[]>>({})
  // Weather cache per day
  const [dayWeather, setDayWeather] = useState<Record<number, DayWeather | null>>({})
  // Transport modes: stored as { 'dayId-fromAssId': mode }
  const [transportModes, setTransportModes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('wndrly_transport_modes') || '{}') } catch { return {} }
  })
  // Optimize route state per day
  const [optimizing, setOptimizing] = useState<Record<number, boolean>>({})
  const [optimizeConfirm, setOptimizeConfirm] = useState<Record<number, boolean>>({})

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

  // Sync localOrders from assignments prop (unless user is actively dragging)
  useEffect(() => {
    if (activeAssignmentId !== null) return
    const newOrders: Record<number, Assignment[]> = {}
    days.forEach(day => {
      const sorted = [...(assignments[String(day.id)] || [])].sort((a, b) => {
        const aTime = parseTimeToMinutes(a.place?.place_time)
        const bTime = parseTimeToMinutes(b.place?.place_time)
        if (aTime !== null && bTime !== null) return aTime - bTime
        if (aTime !== null) return -1
        if (bTime !== null) return 1
        return a.order_index - b.order_index
      })
      newOrders[day.id] = sorted
    })
    setLocalOrders(newOrders)
  }, [days, assignments, activeAssignmentId])

  // Persist transport modes
  useEffect(() => {
    localStorage.setItem('wndrly_transport_modes', JSON.stringify(transportModes))
  }, [transportModes])

  // Fetch weather for days that have a date + at least one place with coordinates
  useEffect(() => {
    days.forEach(day => {
      if (!day.date) return
      if (dayWeather[day.id] !== undefined) return  // already loaded or null
      const dayAssigns = assignments[String(day.id)] || []
      const firstWithCoords = dayAssigns.find(a => a.place?.lat && a.place?.lng)
      if (!firstWithCoords?.place) return
      const { lat, lng } = firstWithCoords.place
      if (!lat || !lng) return
      // Check if date is within 5-day forecast window
      const dayDate = new Date(day.date)
      const now = new Date()
      const diffDays = Math.floor((dayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < -1 || diffDays > 14) {
        setDayWeather(prev => ({ ...prev, [day.id]: null }))
        return
      }
      weatherApi.get(lat, lng, day.date)
        .then((data: Record<string, unknown>) => {
          if (data?.temp !== undefined) {
            const main = String(data.main || data.type || 'Clear')
            setDayWeather(prev => ({ ...prev, [day.id]: {
              temp: data.temp as number,
              description: String(data.description || main),
              main,
              emoji: weatherMainToEmoji(main),
              wind_max: data.wind_max as number | undefined,
              precip: data.precipitation_sum as number | undefined,
            }}))
          } else {
            setDayWeather(prev => ({ ...prev, [day.id]: null }))
          }
        })
        .catch(() => setDayWeather(prev => ({ ...prev, [day.id]: null })))
    })
  }, [days, assignments])

  // All days sorted assignments (uses localOrders for DnD, falls back to prop)
  const allDayAssignments = useMemo(() => {
    return days.map(day => {
      // If we have a local DnD-reordered version, use it
      if (localOrders[day.id]) {
        return { day, assignments: localOrders[day.id] }
      }
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
  }, [days, assignments, localOrders])

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

  // ─── DnD handlers ───────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveAssignmentId(Number(event.active.id))
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent, dayId: number) => {
    setActiveAssignmentId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    setLocalOrders(prev => {
      const current = prev[dayId] || []
      const oldIdx = current.findIndex(a => a.id === Number(active.id))
      const newIdx = current.findIndex(a => a.id === Number(over.id))
      if (oldIdx === -1 || newIdx === -1) return prev
      const reordered = arrayMove(current, oldIdx, newIdx)
      // Save to backend
      if (tripId) {
        assignmentsApi.reorder(tripId, dayId, reordered.map(a => a.id))
          .then(() => onReorderDay?.(dayId, reordered.map(a => a.id)))
          .catch(() => console.error('Failed to save order'))
      }
      return { ...prev, [dayId]: reordered }
    })
  }, [tripId, onReorderDay])

  // ─── Optimize Route ────────────────────────────────────────────────────
  const handleOptimizeRoute = useCallback(async (dayId: number, dayAssignments: Assignment[]) => {
    const withCoords = dayAssignments.filter(a => a.place?.lat && a.place?.lng)
    if (withCoords.length < 3) return
    setOptimizing(prev => ({ ...prev, [dayId]: true }))
    try {
      // Nearest-neighbor TSP starting from first place
      const start = withCoords[0]
      const remaining = [...withCoords.slice(1)]
      const optimized: Assignment[] = [start]

      while (remaining.length > 0) {
        const last = optimized[optimized.length - 1]
        let nearestIdx = 0
        let nearestDist = Infinity
        remaining.forEach((a, i) => {
          const d = haversineDistance(
            last.place!.lat!, last.place!.lng!,
            a.place!.lat!, a.place!.lng!
          )
          if (d < nearestDist) { nearestDist = d; nearestIdx = i }
        })
        optimized.push(remaining[nearestIdx])
        remaining.splice(nearestIdx, 1)
      }

      // Add back any assignments without coords at the end
      const withoutCoords = dayAssignments.filter(a => !a.place?.lat || !a.place?.lng)
      const finalOrder = [...optimized, ...withoutCoords]

      setLocalOrders(prev => ({ ...prev, [dayId]: finalOrder }))
      setOptimizeConfirm(prev => ({ ...prev, [dayId]: true }))
      setTimeout(() => setOptimizeConfirm(prev => ({ ...prev, [dayId]: false })), 3000)

      if (tripId) {
        await assignmentsApi.reorder(tripId, dayId, finalOrder.map(a => a.id))
        onReorderDay?.(dayId, finalOrder.map(a => a.id))
      }
    } finally {
      setOptimizing(prev => ({ ...prev, [dayId]: false }))
    }
  }, [tripId, onReorderDay])

  // ─── Transport mode edit ──────────────────────────────────────────────────
  const handleSetTransportMode = useCallback((fromAssId: number, dayId: number, mode: string) => {
    const key = `${dayId}-${fromAssId}`
    setTransportModes(prev => ({ ...prev, [key]: mode }))
    // Also update transport_mode on the fromPlace via places API
    if (tripId) {
      const dayAssigns = localOrders[dayId] || []
      const fromAssign = dayAssigns.find(a => a.id === fromAssId)
      if (fromAssign?.place) {
        placesApi.update(tripId, fromAssign.place.id, { transport_mode: mode })
          .catch(() => console.warn('Could not save transport mode'))
      }
    }
  }, [tripId, localOrders])

  const getTransportModeForGap = useCallback((fromAssId: number, dayId: number, fromPlace: Place) => {
    const key = `${dayId}-${fromAssId}`
    return transportModes[key] || fromPlace.transport_mode || null
  }, [transportModes])

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
                placeholder="Search places..."
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
                  const mode = getTransportModeForGap(dayAssignments[i].id, day.id, a)
                  const spd = getTransportSpeed(mode)
                  totalTransitMins += Math.max(1, Math.round((haversineDistance(a.lat, a.lng, b.lat, b.lng) / spd) * 60))
                }
              }

              const canOptimize = dayAssignments.filter(a => a.place?.lat && a.place?.lng).length >= 3
              const weather = dayWeather[day.id]

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                        Day {dayNumber}{day.title ? ` · ${day.title}` : ''}
                        {day.date && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </h2>
                      {/* Weather badge */}
                      <WeatherBadge weather={weather} />
                      {/* Optimize Route button */}
                      {canOptimize && (
                        <button
                          onClick={() => handleOptimizeRoute(day.id, dayAssignments)}
                          disabled={!!optimizing[day.id]}
                          title="Optimize visiting order by distance"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                            cursor: optimizing[day.id] ? 'wait' : 'pointer',
                            border: 'none',
                            background: optimizeConfirm[day.id] ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.1)',
                            color: optimizeConfirm[day.id] ? '#10b981' : '#6366f1',
                            transition: 'all 0.2s',
                            flexShrink: 0,
                          }}
                        >
                          {optimizeConfirm[day.id] ? <><Check size={11} /> Optimized!</> : optimizing[day.id] ? '⏳…' : <><Zap size={11} /> Optimize</>}
                        </button>
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
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={e => handleDragEnd(e, day.id)}
                      >
                        <SortableContext
                          items={dayAssignments.map(a => a.id)}
                          strategy={verticalListSortingStrategy}
                        >
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
                                  <SortableActivityItem
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
                                    activeId={activeAssignmentId}
                                  />
                                </div>
                              </div>
                              {idx < dayAssignments.length - 1 && dayAssignments[idx + 1].place && (
                                <div style={{ paddingLeft: 78 }}>
                                  <TransitGap
                                    fromPlace={place}
                                    toPlace={dayAssignments[idx + 1].place}
                                    transportMode={getTransportModeForGap(assignment.id, day.id, place)}
                                    onEditTransport={mode => handleSetTransportMode(assignment.id, day.id, mode)}
                                  />
                                </div>
                              )}
                            </div>
                          )
                            })}
                          </div>
                        </SortableContext>
                        <DragOverlay>
                          {activeAssignmentId ? (() => {
                            const a = dayAssignments.find(x => x.id === activeAssignmentId)
                            if (!a) return null
                            const st = a.place?.place_time ? formatTime(a.place.place_time, locale, timeFormat) : null
                            const et = a.place?.end_time ? formatTime(a.place.end_time, locale, timeFormat) : null
                            return (
                              <div style={{ transform: 'rotate(1.5deg)', paddingLeft: 78, paddingRight: 16 }}>
                                <ActivityCard
                                  assignment={a}
                                  startTime={st}
                                  endTime={et}
                                  categories={categories}
                                  onClick={() => {}}
                                  isSelected={false}
                                  highlight={false}
                                  isDragging={true}
                                />
                              </div>
                            )
                          })() : null}
                        </DragOverlay>
                      </DndContext>
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
