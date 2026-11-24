import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CompilerErrorTranslatorService {
  private readonly logger = new Logger(CompilerErrorTranslatorService.name);

  public translateDiagnostic(diagnosticCode: string, rawMessage: string): string {
    if (diagnosticCode === 'TS2322' || rawMessage.includes('Type') && rawMessage.includes('not assignable')) {
      return 'Type mismatch: You passed an incompatible type to this variable or parameter.';
    }
    if (diagnosticCode === 'TS2304' || rawMessage.includes('Cannot find name')) {
      return 'Undefined symbol: The variable or function name is not imported or declared.';
    }
    return rawMessage;
  }
}
