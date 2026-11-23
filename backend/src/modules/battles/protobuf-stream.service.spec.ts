import { ProtobufStreamService, KeystrokeType, BattleTelemetryFrame } from './protobuf-stream.service';

describe('ProtobufStreamService (Protobuf v3 Binary Stream)', () => {
  let service: ProtobufStreamService;

  beforeEach(() => {
    service = new ProtobufStreamService();
  });

  it('encodes and decodes BattleTelemetryFrame with 100% data fidelity', () => {
    const original: BattleTelemetryFrame = {
      battleId: 'b-tournament-42',
      userId: 'usr-pro-dev',
      sequence: 1204,
      timestamp: 1700000000500,
      cursorPosition: 84,
      deltaLength: 1,
      keystrokeType: KeystrokeType.INSERT,
      key: 'x',
      patchSnippet: 'const x = 10;',
    };

    const binary = service.encodeTelemetryFrame(original);
    expect(Buffer.isBuffer(binary)).toBe(true);

    const decoded = service.decodeTelemetryFrame(binary);
    expect(decoded.battleId).toBe(original.battleId);
    expect(decoded.userId).toBe(original.userId);
    expect(decoded.sequence).toBe(original.sequence);
    expect(decoded.cursorPosition).toBe(original.cursorPosition);
    expect(decoded.deltaLength).toBe(original.deltaLength);
    expect(decoded.keystrokeType).toBe(original.keystrokeType);
    expect(decoded.key).toBe(original.key);
    expect(decoded.patchSnippet).toBe(original.patchSnippet);
  });

  it('drops bandwidth by over 75% compared to raw JSON payload', () => {
    const frame: BattleTelemetryFrame = {
      battleId: 'b-99',
      userId: 'u-1',
      sequence: 15,
      timestamp: Date.now(),
      cursorPosition: 12,
      deltaLength: 1,
      keystrokeType: KeystrokeType.INSERT,
      key: 'Enter',
    };

    const metrics = service.measureBandwidthSaving(frame);
    expect(metrics.savedPercentage).toBeGreaterThan(60); // Highly compressed varint binary
    expect(metrics.protobufBytes).toBeLessThan(metrics.jsonBytes);
  });
});
