import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class JsdocDecoratorDocGeneratorService {
  private readonly logger = new Logger(JsdocDecoratorDocGeneratorService.name);

  public generateMarkdownDoc(className: string, decorators: string[]): string {
    this.logger.log(`Generated documentation for class ${className}`);
    return `# Class ${className}\n\nDecorators: ${decorators.join(', ')}`;
  }
}
