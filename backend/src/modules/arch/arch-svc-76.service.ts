/**
 * Architecture Service 76: RabbitMQ Baggage Propagator
 * Subsystem: Distributed Tracing Baggage Across AMQP
 */

export class AmqpBaggagePropagatorService {
  public injectBaggage(headers: Record<string, string>, baggage: Record<string, string>): Record<string, string> {
    const encoded = Object.entries(baggage)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join(',');

    return {
      ...headers,
      'baggage': encoded,
    };
  }

  public extractBaggage(headers: Record<string, string>): Record<string, string> {
    const raw = headers['baggage'];
    if (!raw) return {};

    const result: Record<string, string> = {};
    const pairs = raw.split(',');
    for (const pair of pairs) {
      const [k, v] = pair.split('=');
      if (k && v) {
        result[decodeURIComponent(k)] = decodeURIComponent(v);
      }
    }
    return result;
  }
}
