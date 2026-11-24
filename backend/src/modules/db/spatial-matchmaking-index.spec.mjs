import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SpatialMatchmakingIndexService {
  constructor() { this.players = new Map(); }
  registerPlayer(p) { this.players.set(p.playerId, p); }
  haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }
  findNearbyPlayers(id, radiusKm) {
    const t = this.players.get(id);
    if (!t) return [];
    return Array.from(this.players.entries())
      .filter(([pid, p]) => pid !== id && this.haversineDistanceKm(t.lat, t.lon, p.lat, p.lon) <= radiusKm)
      .map(([pid]) => pid);
  }
}

describe('SpatialMatchmakingIndexService (Issue #1833)', () => {
  it('should calculate Haversine geographic distances and filter nearby matchmaking opponents', () => {
    const spatial = new SpatialMatchmakingIndexService();
    spatial.registerPlayer({ playerId: 'p-ny', lat: 40.7128, lon: -74.0060 });
    spatial.registerPlayer({ playerId: 'p-philly', lat: 39.9526, lon: -75.1652 });
    spatial.registerPlayer({ playerId: 'p-tokyo', lat: 35.6762, lon: 139.6503 });

    const nearby = spatial.findNearbyPlayers('p-ny', 200);
    assert.deepEqual(nearby, ['p-philly']);
  });
});
