// ── Unsplash Cover Image Service ─────────────────────────────────────────
// Fetches landscape travel photos for trip banners via Unsplash API (free tier).
// Requires UNSPLASH_ACCESS_KEY env variable.

const UNSPLASH_BASE = 'https://api.unsplash.com';

export interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  user: {
    name: string;
    links: { html: string };
  };
  links: { html: string };
}

interface SearchResponse {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

/**
 * Search Unsplash for a travel photo matching the given query.
 * Returns a random photo from the first page of results.
 */
export async function searchUnsplashPhoto(
  query: string,
  page = 1
): Promise<UnsplashPhoto | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.warn('[unsplash] UNSPLASH_ACCESS_KEY not set — skipping cover fetch');
    return null;
  }

  try {
    const params = new URLSearchParams({
      query: `${query} travel landscape`,
      orientation: 'landscape',
      per_page: '10',
      page: String(page),
    });
    const res = await fetch(`${UNSPLASH_BASE}/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${key}`,
        'Accept-Version': 'v1',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[unsplash] API error ${res.status}: ${res.statusText}`);
      return null;
    }

    const data = (await res.json()) as SearchResponse;
    if (!data.results || data.results.length === 0) return null;

    // Pick a random photo from results for variety
    const idx = Math.floor(Math.random() * data.results.length);
    return data.results[idx];
  } catch (err) {
    console.warn('[unsplash] Fetch failed:', err);
    return null;
  }
}

/**
 * Given a list of destination strings (or a trip title), fetch a suitable
 * landscape cover image URL from Unsplash.
 *
 * @param destinations Array of destination names, or a single trip title
 * @returns `urls.regular` (≈1080px wide) or null on failure
 */
export async function fetchTripCoverImage(
  destinations: string[]
): Promise<string | null> {
  if (!destinations || destinations.length === 0) return null;

  // Use first destination as primary query; fall back to full list joined
  const primary = destinations[0].trim();
  if (!primary) return null;

  const photo = await searchUnsplashPhoto(primary);
  if (photo) return photo.urls.regular;

  // Fallback: try remaining destinations
  for (let i = 1; i < destinations.length; i++) {
    const alt = destinations[i].trim();
    if (!alt) continue;
    const p2 = await searchUnsplashPhoto(alt);
    if (p2) return p2.urls.regular;
  }

  return null;
}

/**
 * Extract likely destination names from a trip title.
 * Handles formats like "Malaysia + Japan + Korea 2026", "Paris & Rome Trip", etc.
 */
export function extractDestinationsFromTitle(title: string): string[] {
  // Remove common trip noise words
  const cleaned = title
    .replace(/\b(trip|tour|travel|vacation|holiday|adventure|journey|road\s*trip|\d{4})\b/gi, '')
    .trim();

  // Split on common separators: +, &, and, /, |, comma
  const parts = cleaned
    .split(/[+&,/|]|\band\b/i)
    .map(p => p.trim())
    .filter(p => p.length > 1);

  return parts.length > 0 ? parts : [title.trim()];
}
