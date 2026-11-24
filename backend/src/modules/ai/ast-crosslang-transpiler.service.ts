import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AstCrosslangTranspilerService {
  private readonly logger = new Logger(AstCrosslangTranspilerService.name);

  public pythonToTypescript(pyCode: string): string {
    return pyCode
      .replace(/def ([a-zA-Z0-9_]+)\((.*?)\):/g, 'function $1($2) {')
      .replace(/print\((.*?)\)/g, 'console.log($1)');
  }
}
