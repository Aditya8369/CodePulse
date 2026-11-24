import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UntypedJsTypeInferrerService {
  private readonly logger = new Logger(UntypedJsTypeInferrerService.name);

  public inferType(valueRepresentation: string): 'string' | 'number' | 'boolean' | 'object' | 'unknown' {
    if (valueRepresentation.startsWith('"') || valueRepresentation.startsWith("'")) return 'string';
    if (!isNaN(Number(valueRepresentation)) && valueRepresentation.trim() !== '') return 'number';
    if (valueRepresentation === 'true' || valueRepresentation === 'false') return 'boolean';
    if (valueRepresentation.startsWith('{') || valueRepresentation.startsWith('[')) return 'object';
    return 'unknown';
  }
}
