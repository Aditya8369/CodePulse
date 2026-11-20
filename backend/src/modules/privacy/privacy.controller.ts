import { Controller, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { AnonymizerService, GdprPurgeReceipt } from './anonymizer.service';

@Controller('privacy')
export class PrivacyController {
  constructor(private readonly anonymizerService: AnonymizerService) {}

  @Post('delete-account/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Param('id') id: string): Promise<GdprPurgeReceipt> {
    return this.anonymizerService.purgeAndAnonymizeUser(id);
  }
}
