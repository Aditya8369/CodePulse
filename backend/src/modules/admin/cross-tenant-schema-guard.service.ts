import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CrossTenantSchemaGuardService {
  private readonly logger = new Logger(CrossTenantSchemaGuardService.name);

  public sanitizeConnectionOnRelease(connection: { currentSchema: string }): { reset: boolean; currentSchema: string } {
    if (connection.currentSchema !== 'public') {
      this.logger.warn(`Resetting connection schema from ${connection.currentSchema} back to public.`);
      connection.currentSchema = 'public';
      return { reset: true, currentSchema: 'public' };
    }
    return { reset: false, currentSchema: connection.currentSchema };
  }
}
