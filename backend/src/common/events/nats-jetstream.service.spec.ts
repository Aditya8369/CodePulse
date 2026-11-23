import { CloudEventsProvider } from './cloudevents.provider';
import { NatsJetStreamService } from './nats-jetstream.service';

describe('NatsJetStreamService & CloudEventsProvider', () => {
  let cloudEvents: CloudEventsProvider;
  let service: NatsJetStreamService;

  beforeEach(async () => {
    cloudEvents = new CloudEventsProvider();
    service = new NatsJetStreamService(cloudEvents);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onApplicationShutdown();
  });

  it('formats domain events conforming to CloudEvents 1.0 specification', () => {
    const event = cloudEvents.createEvent({
      source: '/services/battles',
      type: 'com.codepulse.battle.completed',
      subject: 'battle-1234',
      data: {
        battleId: 'battle-1234',
        winnerId: 'user-winner',
        score: 98.5,
      },
    });

    expect(event.specversion).toBe('1.0');
    expect(event.id).toBeDefined();
    expect(event.source).toBe('/services/battles');
    expect(event.type).toBe('com.codepulse.battle.completed');
    expect(event.datacontenttype).toBe('application/json');
    expect(event.subject).toBe('battle-1234');
    expect(cloudEvents.validateEvent(event)).toBe(true);
  });

  it('serializes and deserializes CloudEvents accurately', () => {
    const event = cloudEvents.createEvent({
      source: '/services/users',
      type: 'com.codepulse.user.level_up',
      data: { userId: 'u-1', newLevel: 42 },
    });

    const serialized = cloudEvents.serialize(event);
    const deserialized = cloudEvents.deserialize(serialized);

    expect(deserialized.id).toBe(event.id);
    expect(deserialized.data).toEqual({ userId: 'u-1', newLevel: 42 });
  });

  it('publishes events to JetStream with sequence incrementation', async () => {
    const ack1 = await service.publish('battles.completed', {
      source: '/services/battles',
      type: 'com.codepulse.battle.completed',
      data: { match: 1 },
    });

    const ack2 = await service.publish('battles.completed', {
      source: '/services/battles',
      type: 'com.codepulse.battle.completed',
      data: { match: 2 },
    });

    expect(ack1.duplicate).toBe(false);
    expect(ack1.seq).toBe(1);
    expect(ack2.seq).toBe(2);
  });

  it('deduplicates identical message IDs within deduplication window', async () => {
    const event = cloudEvents.createEvent({
      id: 'custom-id-999',
      source: '/services/battles',
      type: 'com.codepulse.battle.completed',
      data: { match: 999 },
    });

    const ack1 = await service.publish('battles.completed', event);
    expect(ack1.duplicate).toBe(false);
    expect(ack1.seq).toBeGreaterThan(0);

    const ack2 = await service.publish('battles.completed', event);
    expect(ack2.duplicate).toBe(true);
    expect(ack2.seq).toBe(-1);
  });

  it('delivers messages to consumer groups with offset tracking and acknowledgments', async () => {
    const received: any[] = [];
    await service.subscribe('BATTLES', 'battles.*', 'elo-worker', async (event, ctx) => {
      received.push(event.data);
      await ctx.ack();
    });

    await service.publish('battles.finished', {
      source: '/services/battles',
      type: 'com.codepulse.battle.finished',
      data: { battleId: 'b-active-1' },
    });

    expect(received).toHaveLength(1);
    expect(received[0].battleId).toBe('b-active-1');

    const consumerState = service.getConsumerState('BATTLES', 'elo-worker');
    expect(consumerState?.lastAckedSeq).toBeGreaterThan(0);
  });

  it('gracefully drains in-flight messages upon shutdown', async () => {
    const metricsBefore = service.getMetrics();
    expect(metricsBefore.draining).toBe(false);

    await service.onApplicationShutdown('SIGTERM');
    const metricsAfter = service.getMetrics();
    expect(metricsAfter.draining).toBe(true);
    expect(metricsAfter.inFlightCount).toBe(0);
  });
});
