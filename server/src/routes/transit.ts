/**
 * transit.ts — Transit routing API routes
 * GET  /api/transit/route?tripId&originLat&originLng&destLat&destLng&date&time
 * GET  /api/trips/:id/transport-defaults
 * PATCH /api/trips/:id/transport-defaults
 * GET  /api/trips/:id/days/:dayId/transport-default
 * PATCH /api/trips/:id/days/:dayId/transport-default
 * GET  /api/trips/:id/city-transport
 * PUT  /api/trips/:id/city-transport/:label
 * DELETE /api/trips/:id/city-transport/:label
 */

import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { db, canAccessTrip } from '../db/database';
import { fetchTransitRoute, purgeTransitCache } from '../services/transitService';
import { getMapsKey } from '../services/mapsService';

const router = express.Router();

// ─── Transit route lookup ─────────────────────────────────────────────────────

router.get('/route', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { tripId, originLat, originLng, destLat, destLng, date, time } = req.query as Record<string, string>;

  if (!originLat || !originLng || !destLat || !destLng) {
    return res.status(400).json({ error: 'originLat, originLng, destLat, destLng required' });
  }

  // Verify trip access when tripId provided
  if (tripId) {
    const ok = canAccessTrip(authReq.user.id, parseInt(tripId, 10));
    if (!ok) return res.status(403).json({ error: 'No access to trip' });
  }

  const apiKey = getMapsKey(authReq.user.id);
  const result = await fetchTransitRoute(
    apiKey,
    parseFloat(originLat), parseFloat(originLng),
    parseFloat(destLat), parseFloat(destLng),
    date || null,
    time || null,
  );

  if ('code' in result) {
    return res.status(200).json({ error: result });
  }
  res.json(result);
});

// ─── Trip-level transport defaults ───────────────────────────────────────────

router.get('/trips/:id/defaults', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tripId = parseInt(req.params.id, 10);
  if (!canAccessTrip(authReq.user.id, tripId)) return res.status(403).json({ error: 'No access' });

  const trip = db.prepare('SELECT id, default_transport_mode FROM trips WHERE id = ?').get(tripId) as { id: number; default_transport_mode: string } | undefined;
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  res.json({ default_transport_mode: trip.default_transport_mode || 'walking+transit' });
});

router.patch('/trips/:id/defaults', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tripId = parseInt(req.params.id, 10);
  if (!canAccessTrip(authReq.user.id, tripId)) return res.status(403).json({ error: 'No access' });

  const { default_transport_mode } = req.body;
  const VALID_MODES = ['walking+transit', 'walking', 'car', 'taxi', 'bike', 'mixed'];
  if (!VALID_MODES.includes(default_transport_mode)) {
    return res.status(400).json({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}` });
  }

  db.prepare('UPDATE trips SET default_transport_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(default_transport_mode, tripId);

  res.json({ default_transport_mode });
});

// ─── Day-level transport override ─────────────────────────────────────────────

router.get('/trips/:id/days/:dayId/transport', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tripId = parseInt(req.params.id, 10);
  if (!canAccessTrip(authReq.user.id, tripId)) return res.status(403).json({ error: 'No access' });

  const day = db.prepare('SELECT id, default_transport_mode FROM days WHERE id = ? AND trip_id = ?')
    .get(parseInt(req.params.dayId, 10), tripId) as { id: number; default_transport_mode: string | null } | undefined;
  if (!day) return res.status(404).json({ error: 'Day not found' });

  res.json({ default_transport_mode: day.default_transport_mode });
});

router.patch('/trips/:id/days/:dayId/transport', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tripId = parseInt(req.params.id, 10);
  if (!canAccessTrip(authReq.user.id, tripId)) return res.status(403).json({ error: 'No access' });

  const { default_transport_mode } = req.body;
  const VALID_MODES = ['walking+transit', 'walking', 'car', 'taxi', 'bike', 'mixed', null];
  if (!VALID_MODES.includes(default_transport_mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  db.prepare('UPDATE days SET default_transport_mode = ? WHERE id = ? AND trip_id = ?')
    .run(default_transport_mode, parseInt(req.params.dayId, 10), tripId);

  res.json({ default_transport_mode });
});

// ─── City-level transport overrides ──────────────────────────────────────────

router.get('/trips/:id/city-transport', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tripId = parseInt(req.params.id, 10);
  if (!canAccessTrip(authReq.user.id, tripId)) return res.status(403).json({ error: 'No access' });

  const rows = db.prepare('SELECT id, city_label, transport_mode FROM trip_city_transport WHERE trip_id = ? ORDER BY city_label ASC')
    .all(tripId) as { id: number; city_label: string; transport_mode: string }[];

  res.json(rows);
});

router.put('/trips/:id/city-transport/:label', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tripId = parseInt(req.params.id, 10);
  if (!canAccessTrip(authReq.user.id, tripId)) return res.status(403).json({ error: 'No access' });

  const { transport_mode } = req.body;
  const VALID_MODES = ['walking+transit', 'walking', 'car', 'taxi', 'bike', 'mixed'];
  if (!VALID_MODES.includes(transport_mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  const city_label = decodeURIComponent(req.params.label);
  db.prepare(`
    INSERT INTO trip_city_transport (trip_id, city_label, transport_mode, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(trip_id, city_label) DO UPDATE SET transport_mode = excluded.transport_mode, updated_at = CURRENT_TIMESTAMP
  `).run(tripId, city_label, transport_mode);

  res.json({ city_label, transport_mode });
});

router.delete('/trips/:id/city-transport/:label', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const tripId = parseInt(req.params.id, 10);
  if (!canAccessTrip(authReq.user.id, tripId)) return res.status(403).json({ error: 'No access' });

  const city_label = decodeURIComponent(req.params.label);
  db.prepare('DELETE FROM trip_city_transport WHERE trip_id = ? AND city_label = ?').run(tripId, city_label);
  res.json({ ok: true });
});

// ─── Admin: purge transit cache ───────────────────────────────────────────────

router.post('/cache/purge', authenticate, (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (authReq.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const deleted = purgeTransitCache();
  res.json({ deleted });
});

export default router;
