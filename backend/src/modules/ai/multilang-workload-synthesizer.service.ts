import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MultilangWorkloadSynthesizerService {
  private readonly logger = new Logger(MultilangWorkloadSynthesizerService.name);

  public synthesizeBenchmark(language: 'typescript' | 'python' | 'cpp', opsCount: number): string {
    this.logger.log(`Synthesizing benchmark harness for ${language} with ${opsCount} operations.`);
    if (language === 'python') return `for _ in range(${opsCount}): pass`;
    if (language === 'cpp') return `for(int i=0; i<${opsCount}; ++i) {}`;
    return `for(let i=0; i<${opsCount}; i++) {}`;
  }
}
