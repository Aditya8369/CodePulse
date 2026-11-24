import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TestcaseMutationFuzzerService {
  private readonly logger = new Logger(TestcaseMutationFuzzerService.name);

  public mutateTestCaseInput(originalInput: string): string[] {
    return [
      originalInput.trim(),
      `${originalInput} `,
      originalInput.toUpperCase(),
      `${originalInput}\n`,
    ];
  }
}
