import { Injectable, Logger } from '@nestjs/common';

export interface HazardEvent {
  triggerSec: number;
  hazardType: 'SUDDEN_DEATH' | 'LAVA_RISE' | 'EMP_BLAST';
}

@Injectable()
export class ArenaHazardEventSequencerService {
  private readonly logger = new Logger(ArenaHazardEventSequencerService.name);
  private schedule: HazardEvent[] = [
    { triggerSec: 180, hazardType: 'EMP_BLAST' },
    { triggerSec: 300, hazardType: 'LAVA_RISE' },
    { triggerSec: 420, hazardType: 'SUDDEN_DEATH' },
  ];

  public getNextHazard(currentSec: number): HazardEvent | null {
    return this.schedule.find(h => h.triggerSec > currentSec) || null;
  }
}
