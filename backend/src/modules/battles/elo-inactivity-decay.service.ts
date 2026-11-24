export class EloInactivityDecayService {
  public calculateDecayedRating(currentRating: number, daysInactive: number, decayPerDay: number = 2): number {
    if (daysInactive <= 14) return currentRating; // 14-day grace period
    const penalizableDays = daysInactive - 14;
    const decayed = currentRating - (penalizableDays * decayPerDay);
    return Math.max(1000, decayed); // Minimum floor rating
  }
}
