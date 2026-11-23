import { Module, Global } from '@nestjs/common';
import { CloudEventsProvider } from './cloudevents.provider';
import { NatsJetStreamService } from './nats-jetstream.service';

@Global()
@Module({
  providers: [CloudEventsProvider, NatsJetStreamService],
  exports: [CloudEventsProvider, NatsJetStreamService],
})
export class EventsModule {}
