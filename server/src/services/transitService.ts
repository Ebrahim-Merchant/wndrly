/**
 * transitService.ts
 * Google Routes API (TRANSIT mode) integration with SQLite caching.
 * Phase 2 of the transit-first transport feature.
 */

import { db } from '../db/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransitLeg {
  type: 'WALK' | 'TRANSIT';
  // walk leg
  distanceMeters?: number;
  durationSeconds?: number;
  // transit leg
  lineName?: string;
  lineShortName?: string;
  agencyName?: string;
  vehicleType?: string; // BUS, SUBWAY, RAIL, FERRY, TRAM, etc.
  numStops?: number;
  departureStop?: string;
  arrivalStop?: string;
  departureTime?: string; // ISO string
  arrivalTime?: string;
  headsign?: string;
  polyline?: string; // encoded polyline for this leg
}

export interface TransitResult {
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  legs: TransitLeg[];
  departureTime: string;
  arrivalTime: string;
  polyline?: string; // full route polyline
  source: 'cache' | 'api';
}

export interface TransitError {
  code: 'NO_TRANSIT' | 'API_ERROR' | 'TOO_LONG' | 'NO_KEY';
  message: string;
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

function makeCacheId(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  dateBucket: string, hourBucket: number
): string {
  return [
    originLat.toFixed(4), originLng.toFixed(4),
    destLat.toFixed(4), destLng.toFixed(4),
    dateBucket, String(hourBucket)
  ].join('|');
}

function pruneCacheExpired(): void {
  const now = Math.floor(Date.now() / 1000);
  try {
    db.prepare('DELETE FROM transit_cache WHERE expires_at < ?').run(now);
  } catch (_) {
    // table may not exist yet during first boot
  }
}

function readCache(id: string): TransitResult | null {
  const now = Math.floor(Date.now() / 1000);
  try {
    const row = db.prepare(
      'SELECT response FROM transit_cache WHERE id = ? AND expires_at > ?'
    ).get(id, now) as { response: string } | undefined;
    if (!row) return null;
    const parsed = JSON.parse(row.response) as TransitResult;
    parsed.source = 'cache';
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeCache(id: string, originLat: number, originLng: number, destLat: number, destLng: number, dateBucket: string, hourBucket: number, result: TransitResult): void {
  const now = Math.floor(Date.now() / 1000);
  const today = new Date().toISOString().slice(0, 10);
  const isSameDay = dateBucket === today;
  const ttl = isSameDay ? 6 * 3600 : 24 * 3600;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO transit_cache (id, origin_lat, origin_lng, dest_lat, dest_lng, date_bucket, hour_bucket, response, fetched_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, originLat, originLng, destLat, destLng, dateBucket, hourBucket, JSON.stringify(result), now, now + ttl);
  } catch (_) {
    // cache write failure is non-fatal
  }
}

// ─── Google Routes API call ──────────────────────────────────────────────────

async function callRoutesApi(
  apiKey: string,
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  departureDatetime: Date
): Promise<TransitResult> {
  const body = {
    origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
    destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
    travelMode: 'TRANSIT',
    computeAlternativeRoutes: false,
    departureTime: departureDatetime.toISOString(),
    transitPreferences: {
      routingPreference: 'FEWER_TRANSFERS',
    },
  };

  const res = await fetch(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'routes.duration',
          'routes.distanceMeters',
          'routes.polyline.encodedPolyline',
          'routes.legs.steps',
          'routes.legs.polyline',
          'routes.travelAdvisory',
        ].join(','),
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Routes API HTTP ${res.status}: ${text}`);
  }

  const data = await res.json() as any;

  if (!data.routes || data.routes.length === 0) {
    throw Object.assign(new Error('No transit routes found'), { code: 'NO_TRANSIT' });
  }

  const route = data.routes[0];
  const legs: TransitLeg[] = [];

  for (const leg of (route.legs || [])) {
    for (const step of (leg.steps || [])) {
      if (step.travelMode === 'WALK') {
        legs.push({
          type: 'WALK',
          distanceMeters: step.distanceMeters,
          durationSeconds: step.staticDuration
            ? parseDurationString(step.staticDuration)
            : undefined,
          polyline: step.polyline?.encodedPolyline,
        });
      } else if (step.travelMode === 'TRANSIT') {
        const td = step.transitDetails || {};
        const line = td.transitLine || {};
        const vehicle = line.vehicle || {};
        legs.push({
          type: 'TRANSIT',
          lineName: line.name || undefined,
          lineShortName: line.nameShort || line.shortName || undefined,
          agencyName: (line.agencies && line.agencies[0]?.name) || undefined,
          vehicleType: vehicle.type || vehicle.name?.toUpperCase() || 'TRANSIT',
          numStops: td.stopCount || undefined,
          departureStop: td.stopDetails?.departureStop?.name || undefined,
          arrivalStop: td.stopDetails?.arrivalStop?.name || undefined,
          departureTime: td.stopDetails?.departureTime || undefined,
          arrivalTime: td.stopDetails?.arrivalTime || undefined,
          headsign: td.headsign || undefined,
          polyline: step.polyline?.encodedPolyline,
          durationSeconds: step.staticDuration
            ? parseDurationString(step.staticDuration)
            : undefined,
        });
      }
    }
  }

  // Compute departure / arrival from leg departure time + duration
  const durationSeconds = route.duration ? parseDurationString(route.duration) : 0;
  const arrivalDate = new Date(departureDatetime.getTime() + durationSeconds * 1000);

  return {
    totalDurationSeconds: durationSeconds,
    totalDistanceMeters: route.distanceMeters || 0,
    legs,
    departureTime: departureDatetime.toISOString(),
    arrivalTime: arrivalDate.toISOString(),
    polyline: route.polyline?.encodedPolyline,
    source: 'api',
  };
}

/** Parse a Routes API duration string like "3600s" → seconds */
function parseDurationString(s: string): number {
  if (!s) return 0;
  const m = s.match(/^(\d+)s$/);
  return m ? parseInt(m[1], 10) : 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a transit route, using cache when available.
 * departureDateHint: optional ISO date string (YYYY-MM-DD) for the day.
 * departureTimeHint: optional HH:MM local time.
 */
export async function fetchTransitRoute(
  apiKey: string | null | undefined,
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  departureDateHint?: string | null,
  departureTimeHint?: string | null,
): Promise<TransitResult | TransitError> {
  if (!apiKey) {
    return { code: 'NO_KEY', message: 'No Maps API key configured' };
  }

  // Build departure datetime
  const dateStr = departureDateHint || new Date().toISOString().slice(0, 10);
  const timeStr = departureTimeHint || '12:00';
  const departureDatetime = new Date(`${dateStr}T${timeStr}:00Z`);

  // Cache key: bucket by day + 2-hour window
  const hourBucket = Math.floor(parseInt(timeStr.split(':')[0] || '12', 10) / 2);
  const cacheId = makeCacheId(originLat, originLng, destLat, destLng, dateStr, hourBucket);

  // Prune expired entries occasionally
  if (Math.random() < 0.05) pruneCacheExpired();

  // Check cache
  const cached = readCache(cacheId);
  if (cached) return cached;

  // Straight-line distance sanity check (>500km → warn, don't call)
  const R = 6371;
  const dLat = ((destLat - originLat) * Math.PI) / 180;
  const dLon = ((destLng - originLng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((originLat * Math.PI) / 180) * Math.cos((destLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  if (distKm > 500) {
    return { code: 'TOO_LONG', message: `Segment is ${Math.round(distKm)} km — transit not suitable` };
  }

  try {
    const result = await callRoutesApi(apiKey, originLat, originLng, destLat, destLng, departureDatetime);
    writeCache(cacheId, originLat, originLng, destLat, destLng, dateStr, hourBucket, result);
    return result;
  } catch (err: any) {
    if (err.code === 'NO_TRANSIT') {
      return { code: 'NO_TRANSIT', message: 'No transit route found for this segment' };
    }
    console.error('[transitService] API error:', err.message);
    return { code: 'API_ERROR', message: err.message || 'Transit API error' };
  }
}

/** Purge all transit cache entries older than now (useful for admin). */
export function purgeTransitCache(): number {
  const now = Math.floor(Date.now() / 1000);
  try {
    const info = db.prepare('DELETE FROM transit_cache WHERE expires_at < ?').run(now);
    return (info as any).changes || 0;
  } catch (_) {
    return 0;
  }
}
