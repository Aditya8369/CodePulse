/**
 * Zero-Copy IPC Transport & Streaming Pipeline Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type SandboxStreamType = 'STDOUT' | 'STDERR' | 'EXEC_EVENT' | 'SYSTEM_DIAGNOSTIC';

export interface SandboxStreamFrame {
  frameId: number;
  executionId: string;
  streamType: SandboxStreamType;
  payload: Uint8Array;
  byteLength: number;
  timestampNano: bigint;
  exitCode?: number;
}

export interface SharedChannelConfig {
  channelId: string;
  slotCapacity?: number;
  slotSizeBytes?: number;
}

export interface SharedChannelDescriptor {
  channelId: string;
  slotCapacity: number;
  slotSizeBytes: number;
  controlBuffer: SharedArrayBuffer;
  payloadBuffer: SharedArrayBuffer;
  metaBuffer: SharedArrayBuffer;
}

export interface ZeroCopyIpcMetrics {
  totalChannelsActive: number;
  totalChannelsRecycled: number;
  totalFramesProduced: number;
  totalFramesConsumed: number;
  totalBytesTransferred: number;
  estimatedMemorySavedBytes: number;
  droppedFramesCount: number;
  averageLatencyMicroseconds: number;
}

export interface ChannelAllocationOptions {
  executionId: string;
  slotCapacity?: number;
  slotSizeBytes?: number;
}
