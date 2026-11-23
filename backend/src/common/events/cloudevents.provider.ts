import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface CloudEvent<T = Record<string, unknown>> {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  time: string;
  datacontenttype: string;
  dataschema?: string;
  subject?: string;
  data: T;
}

export interface CreateCloudEventOptions<T> {
  source: string;
  type: string;
  data: T;
  id?: string;
  subject?: string;
  dataschema?: string;
  time?: string;
}

@Injectable()
export class CloudEventsProvider {
  /**
   * Constructs a CNCF CloudEvents 1.0 compliant envelope.
   */
  createEvent<T>(options: CreateCloudEventOptions<T>): CloudEvent<T> {
    if (!options.source || !options.type) {
      throw new Error('CloudEvent requires source and type attributes');
    }

    return {
      specversion: '1.0',
      id: options.id || crypto.randomUUID(),
      source: options.source,
      type: options.type,
      time: options.time || new Date().toISOString(),
      datacontenttype: 'application/json',
      ...(options.subject ? { subject: options.subject } : {}),
      ...(options.dataschema ? { dataschema: options.dataschema } : {}),
      data: options.data,
    };
  }

  /**
   * Validates if an object conforms to CNCF CloudEvents 1.0 specifications.
   */
  validateEvent(event: unknown): event is CloudEvent<unknown> {
    if (!event || typeof event !== 'object') {
      return false;
    }

    const e = event as Record<string, unknown>;
    return (
      e.specversion === '1.0' &&
      typeof e.id === 'string' &&
      e.id.length > 0 &&
      typeof e.source === 'string' &&
      e.source.length > 0 &&
      typeof e.type === 'string' &&
      e.type.length > 0 &&
      typeof e.time === 'string' &&
      e.datacontenttype === 'application/json' &&
      'data' in e
    );
  }

  /**
   * Serializes a CloudEvent into a Buffer/Uint8Array for wire transport.
   */
  serialize<T>(event: CloudEvent<T>): Uint8Array {
    return Buffer.from(JSON.stringify(event), 'utf-8');
  }

  /**
   * Deserializes wire payload into a typed CloudEvent.
   */
  deserialize<T = Record<string, unknown>>(payload: Uint8Array | string): CloudEvent<T> {
    const raw = typeof payload === 'string' ? payload : Buffer.from(payload).toString('utf-8');
    const parsed = JSON.parse(raw);
    if (!this.validateEvent(parsed)) {
      throw new Error('Invalid CloudEvents 1.0 payload format');
    }
    return parsed as CloudEvent<T>;
  }
}
