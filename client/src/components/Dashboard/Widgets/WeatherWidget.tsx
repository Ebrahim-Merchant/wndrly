import React, { useEffect, useState } from 'react'
import { MapPin, RefreshCw, Droplets, Wind, ChevronDown, ChevronUp } from 'lucide-react'
import { apiClient } from '../../../api/client'
import LiquidGlass from '../LiquidGlass'

interface WeatherData {
  temp: number
  temp_max?: number
  temp_min?: number
  feels_like?: number
  humidity?: number
  main: string
  description: string
  precipitation_probability_max?: number
  wind_max?: number
}

interface DestinationWeather {
  location: string
  lat: number
  lng: number
  weather: WeatherData | null
  loading: boolean
  error: boolean
}

interface WeatherWidgetProps {
  destinations: Array<{ name: string; lat: number; lng: number }>
  dark?: boolean
}

const STORAGE_KEY = 'widget_weather_collapsed'

function weatherEmoji(main: string): string {
  switch (main?.toLowerCase()) {
    case 'clear': return '☀️'
    case 'clouds': return '☁️'
    case 'rain': case 'drizzle': return '🌧️'
    case 'snow': return '❄️'
    case 'thunderstorm': return '⛈️'
    case 'fog': case 'mist': case 'haze': return '🌫️'
    default: return '🌤️'
  }
}

function WeatherCard({ dest }: { dest: DestinationWeather }) {
  const { location, weather, loading, error } = dest
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="flex-1 rounded-xl"
      style={{
        background: 'var(--bg-secondary)',
        minWidth: 0,
        padding: '12px',
        transition: 'transform 0.15s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <MapPin size={10} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        <span
          className="text-[11px] font-semibold truncate"
          style={{ color: 'var(--text-faint)', maxWidth: 90 }}
        >
          {location}
        </span>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="trek-skeleton" style={{ height: 32, width: 60, borderRadius: 6 }} />
          <div className="trek-skeleton" style={{ height: 11, width: 70, borderRadius: 4 }} />
        </div>
      )}

      {error && !loading && (
        <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Unavailable</p>
      )}

      {!loading && !error && weather && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>{weatherEmoji(weather.main)}</span>
            <span
              className="font-extrabold tracking-tight"
              style={{ fontSize: 30, lineHeight: 1, color: 'var(--text-primary)' }}
            >
              {Math.round(weather.temp)}°
            </span>
          </div>
          <p
            className="text-[11px] capitalize leading-tight"
            style={{ color: 'var(--text-secondary)', marginBottom: 6 }}
          >
            {weather.description}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
            {weather.precipitation_probability_max !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Droplets size={10} style={{ color: '#60a5fa' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--text-faint)' }}>
                  {weather.precipitation_probability_max}%
                </span>
              </div>
            )}
            {weather.wind_max !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Wind size={10} style={{ color: 'var(--text-faint)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--text-faint)' }}>
                  {Math.round(weather.wind_max)} km/h
                </span>
              </div>
            )}
          </div>
          {/* Hover detail */}
          <div style={{
            overflow: 'hidden',
            maxHeight: hovered ? 60 : 0,
            opacity: hovered ? 1 : 0,
            transition: 'max-height 0.25s ease, opacity 0.2s ease',
            marginTop: hovered ? 6 : 0,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {weather.feels_like !== undefined && (
                <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                  Feels like {Math.round(weather.feels_like)}°
                </span>
              )}
              {weather.humidity !== undefined && (
                <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                  Humidity {weather.humidity}%
                </span>
              )}
              {weather.temp_max !== undefined && weather.temp_min !== undefined && (
                <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                  H:{Math.round(weather.temp_max)}° · L:{Math.round(weather.temp_min)}°
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function WeatherWidget({ destinations, dark = false }: WeatherWidgetProps) {
  const [destWeather, setDestWeather] = useState<DestinationWeather[]>(() =>
    destinations.slice(0, 2).map(d => ({
      location: d.name, lat: d.lat, lng: d.lng, weather: null, loading: true, error: false,
    }))
  )
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
  }

  const fetchWeather = async () => {
    const current = destinations.slice(0, 2).map(d => ({
      location: d.name, lat: d.lat, lng: d.lng, weather: null as WeatherData | null, loading: true, error: false,
    }))
    setDestWeather([...current])

    await Promise.all(
      current.map(async (dest, idx) => {
        try {
          const res = await apiClient.get('/weather', {
            params: { lat: dest.lat, lng: dest.lng, lang: 'en' },
          })
          current[idx] = { ...dest, weather: res.data, loading: false, error: false }
        } catch {
          current[idx] = { ...dest, loading: false, error: true }
        }
        setDestWeather([...current])
      })
    )
  }

  useEffect(() => {
    if (destinations.length > 0) fetchWeather()
  }, [destinations.map(d => `${d.lat},${d.lng}`).join('|')])

  const isLoading = destWeather.some(d => d.loading)

  if (destinations.length === 0) {
    return (
      <LiquidGlass
        dark={dark}
        style={{ borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="w-1.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #60a5fa 0%, #93c5fd 100%)' }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>🌤️ Weather</span>
          </div>
          <div className="text-center" style={{ padding: '12px 0' }}>
            <span style={{ fontSize: 28 }}>🌤️</span>
            <p className="text-xs" style={{ color: 'var(--text-faint)', marginTop: 6 }}>No destinations with coordinates</p>
          </div>
        </div>
      </LiquidGlass>
    )
  }

  return (
    <LiquidGlass
      dark={dark}
      style={{ borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="w-1.5 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #60a5fa 0%, #93c5fd 100%)' }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>🌤️ Weather</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={(e) => { e.stopPropagation(); fetchWeather() }}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--text-faint)' }}
              title="Refresh"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
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
          maxHeight: collapsed ? 0 : 300,
          opacity: collapsed ? 0 : 1,
          transition: 'max-height 0.3s ease, opacity 0.2s ease',
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {destWeather.map((dest) => (
              <WeatherCard key={dest.location} dest={dest} />
            ))}
          </div>
        </div>
      </div>
    </LiquidGlass>
  )
}
