/**
 * Bi-Temporal Database Versioning & Time-Travel Querying Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface BiTemporalRecord<T = unknown> {
  entityId: string;
  data: T;
  // Valid Time (When the event occurred in the real world)
  validFrom: number;
  validTo: number; // Infinity = currently valid
  // System Time / Transaction Time (When the event was recorded in the database)
  systemFrom: number;
  systemTo: number; // Infinity = current system record
}

export interface TimeTravelQueryOptions {
  entityId: string;
  asOfValidTime?: number;
  asOfSystemTime?: number;
}
