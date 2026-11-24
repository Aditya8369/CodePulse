import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AntiTamperLockstepValidatorService {
  private readonly logger = new Logger(AntiTamperLockstepValidatorService.name);

  public validateTurn(expectedTurn: number, clientTurn: number, clientActionHash: string): boolean {
    if (clientTurn !== expectedTurn) {
      this.logger.error(`Lockstep violation: client submitted turn ${clientTurn}, expected ${expectedTurn}`);
      return false;
    }
    if (!clientActionHash || clientActionHash.length < 16) {
      this.logger.error('Lockstep violation: action hash malformed or empty');
      return false;
    }
    return true;
  }
}
