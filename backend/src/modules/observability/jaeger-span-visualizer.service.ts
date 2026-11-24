export interface SpanLink {
  fromService: string;
  toService: string;
}

export class JaegerSpanVisualizerService {
  private links = new Set<string>();

  public recordDependency(fromService: string, toService: string): void {
    this.links.add(`${fromService}->${toService}`);
  }

  public getDependencyGraph(): SpanLink[] {
    return Array.from(this.links).map(link => {
      const [from, to] = link.split('->');
      return { fromService: from, toService: to };
    });
  }
}
