export interface LokiStream {
  stream: Record<string, string>;
  values: [string, string][];
}

export class LokiProtobufLogShipperService {
  public formatPayload(labels: Record<string, string>, entries: { timestampNs: string; line: string }[]): { streams: LokiStream[] } {
    return {
      streams: [
        {
          stream: labels,
          values: entries.map(e => [e.timestampNs, e.line])
        }
      ]
    };
  }
}
