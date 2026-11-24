export class LogCompactionArchivalService {
  public compactLines(lines: string[]): { compactedPayload: string; count: number } {
    const payload = lines.join('\n');
    return {
      compactedPayload: payload,
      count: lines.length
    };
  }

  public generateArchiveKey(prefix: string, date: Date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${prefix}/${y}/${m}/${d}/logs-${Date.now()}.gz`;
  }
}
