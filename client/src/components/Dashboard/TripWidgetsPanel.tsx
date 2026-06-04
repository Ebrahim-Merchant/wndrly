import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BudgetWidget from './Widgets/BudgetWidget'
import UpcomingActivitiesWidget from './Widgets/UpcomingActivitiesWidget'
import WeatherWidget from './Widgets/WeatherWidget'
import { placesApi } from '../../api/client'

interface Place {
  id: number
  name: string
  lat?: number
  lng?: number
}

interface TripWidgetsPanelProps {
  tripId: number
  dark?: boolean
}

export default function TripWidgetsPanel({ tripId, dark = false }: TripWidgetsPanelProps) {
  const navigate = useNavigate()
  const [places, setPlaces] = useState<Place[]>([])

  useEffect(() => {
    placesApi.list(tripId).then(data => {
      setPlaces(data.places || data || [])
    }).catch(() => {})
  }, [tripId])

  // Pick up to 2 destinations that have lat/lng for weather
  const weatherDests = places
    .filter(p => p.lat && p.lng)
    .slice(0, 2)
    .map(p => ({ name: p.name, lat: p.lat!, lng: p.lng! }))

  return (
    <div className="flex flex-col gap-3">
      {/* Budget + Weather side by side on desktop */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <BudgetWidget tripId={tripId} dark={dark} />
        <WeatherWidget destinations={weatherDests} dark={dark} />
      </div>

      {/* Upcoming activities full-width */}
      <UpcomingActivitiesWidget
        tripId={tripId}
        dark={dark}
        onViewDay={(dayId) => navigate(`/trips/${tripId}?day=${dayId}`)}
      />
    </div>
  )
}
