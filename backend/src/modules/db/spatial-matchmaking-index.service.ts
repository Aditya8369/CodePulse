export interface PlayerLocation {
  playerId: string;
  lat: number;
  lon: number;
}

export class SpatialMatchmakingIndexService {
  private players = new Map<string, PlayerLocation>();

  public registerPlayer(player: PlayerLocation): void {
    this.players.set(player.playerId, player);
  }

  public haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  public findNearbyPlayers(targetPlayerId: string, radiusKm: number): string[] {
    const target = this.players.get(targetPlayerId);
    if (!target) return [];

    const nearby: string[] = [];
    for (const [id, p] of this.players.entries()) {
      if (id !== targetPlayerId) {
        const dist = this.haversineDistanceKm(target.lat, target.lon, p.lat, p.lon);
        if (dist <= radiusKm) {
          nearby.push(id);
        }
      }
    }
    return nearby;
  }
}
