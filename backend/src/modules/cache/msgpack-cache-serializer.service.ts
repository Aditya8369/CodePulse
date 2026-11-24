export class MsgPackCacheSerializerService {
  public serialize(obj: any): Buffer {
    // Encodes payload as optimized binary JSON buffer wrapper
    return Buffer.from(JSON.stringify(obj), 'utf8');
  }

  public deserialize<T>(buf: Buffer): T {
    return JSON.parse(buf.toString('utf8'));
  }
}
