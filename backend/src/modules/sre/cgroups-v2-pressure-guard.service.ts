import { Injectable, Logger } from '@nestjs/common';

export interface PsiPressureData {
  someAvg10: number;
  fullAvg10: number;
}

@Injectable()
export class CgroupsV2PressureGuardService {
  private readonly logger = new Logger(CgroupsV2PressureGuardService.name);

  public evaluateMemoryPressure(psi: PsiPressureData): { action: string; shedRatio: number } {
    if (psi.fullAvg10 > 20 || psi.someAvg10 > 50) {
      this.logger.error(`CRITICAL Memory PSI Stall: full=${psi.fullAvg10}%, some=${psi.someAvg10}%`);
      return { action: 'EMERGENCY_SHED', shedRatio: 0.8 };
    }
    if (psi.someAvg10 > 15) {
      this.logger.warn(`Elevated Memory Pressure: some=${psi.someAvg10}%`);
      return { action: 'THROTTLE_BACKGROUND', shedRatio: 0.3 };
    }
    return { action: 'NONE', shedRatio: 0.0 };
  }
}
