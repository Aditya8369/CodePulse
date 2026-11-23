import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  GossipUpdate,
  SwimMember,
  SwimMemberStatus,
} from './swim-gossip.types';

@Injectable()
export class NodeRegistryService implements OnModuleDestroy {
  private readonly logger = new Logger(NodeRegistryService.name);

  private readonly members = new Map<string, SwimMember>();
  private readonly gossipBuffer = new Map<string, GossipUpdate>();
  private readonly statusListeners: Array<(member: SwimMember, prevStatus: SwimMemberStatus) => void> = [];

  public onModuleDestroy(): void {
    this.members.clear();
    this.gossipBuffer.clear();
    this.statusListeners.length = 0;
  }

  public registerMember(member: SwimMember): void {
    this.members.set(member.nodeId, { ...member });
  }

  public getMember(nodeId: string): SwimMember | undefined {
    return this.members.get(nodeId);
  }

  public getAllMembers(): SwimMember[] {
    return Array.from(this.members.values());
  }

  public getAliveMembers(excludeNodeId?: string): SwimMember[] {
    return Array.from(this.members.values()).filter(
      (m) => m.status === 'ALIVE' && m.nodeId !== excludeNodeId,
    );
  }

  public getSuspectMembers(): SwimMember[] {
    return Array.from(this.members.values()).filter((m) => m.status === 'SUSPECT');
  }

  public updateMemberStatus(
    nodeId: string,
    status: SwimMemberStatus,
    incarnation: number,
  ): boolean {
    const member = this.members.get(nodeId);
    if (!member) {
      return false;
    }

    const prev = member.status;
    member.status = status;
    member.incarnation = Math.max(member.incarnation, incarnation);
    member.lastSeenAt = Date.now();
    if (status === 'SUSPECT') {
      member.suspectSince = Date.now();
    } else {
      member.suspectSince = undefined;
    }

    this.enqueueGossipUpdate({
      nodeId: member.nodeId,
      address: member.address,
      port: member.port,
      status: member.status,
      incarnation: member.incarnation,
      disseminationCount: 0,
    });

    if (prev !== status) {
      for (const listener of this.statusListeners) {
        listener(member, prev);
      }
    }

    return true;
  }

  /**
   * Applies an incoming gossip update following SWIM conflict rules:
   * 1. Higher incarnation always overrides lower incarnation.
   * 2. At equal incarnation: DEAD > SUSPECT > ALIVE.
   * 3. Self-refutation: If update says localNodeId is SUSPECT at incarnation i,
   *    local node refutes by emitting ALIVE with incarnation i + 1.
   */
  public applyGossipUpdate(update: GossipUpdate, localNodeId: string): { refuted: boolean; applied: boolean } {
    if (update.nodeId === localNodeId) {
      if (update.status === 'SUSPECT' || update.status === 'DEAD') {
        const self = this.members.get(localNodeId);
        const nextIncarnation = Math.max(self?.incarnation ?? 0, update.incarnation) + 1;
        if (self) {
          self.incarnation = nextIncarnation;
          self.status = 'ALIVE';
          self.lastSeenAt = Date.now();
        }

        this.enqueueGossipUpdate({
          nodeId: localNodeId,
          address: self?.address ?? '127.0.0.1',
          port: self?.port ?? 8000,
          status: 'ALIVE',
          incarnation: nextIncarnation,
          disseminationCount: 0,
        });

        this.logger.log(`[SWIM Self-Refutation] Refuted false suspect report. Advanced incarnation to ${nextIncarnation}.`);
        return { refuted: true, applied: true };
      }
      return { refuted: false, applied: false };
    }

    const existing = this.members.get(update.nodeId);
    if (!existing) {
      this.members.set(update.nodeId, {
        nodeId: update.nodeId,
        address: update.address,
        port: update.port,
        status: update.status,
        incarnation: update.incarnation,
        lastSeenAt: Date.now(),
      });
      this.enqueueGossipUpdate(update);
      return { refuted: false, applied: true };
    }

    let shouldApply = false;
    if (update.incarnation > existing.incarnation) {
      shouldApply = true;
    } else if (update.incarnation === existing.incarnation) {
      if (update.status === 'DEAD' && existing.status !== 'DEAD') {
        shouldApply = true;
      } else if (update.status === 'SUSPECT' && existing.status === 'ALIVE') {
        shouldApply = true;
      }
    }

    if (shouldApply) {
      const prev = existing.status;
      existing.status = update.status;
      existing.incarnation = update.incarnation;
      existing.lastSeenAt = Date.now();
      if (update.status === 'SUSPECT') {
        existing.suspectSince = Date.now();
      } else {
        existing.suspectSince = undefined;
      }

      this.enqueueGossipUpdate(update);

      if (prev !== update.status) {
        for (const listener of this.statusListeners) {
          listener(existing, prev);
        }
      }
      return { refuted: false, applied: true };
    }

    return { refuted: false, applied: false };
  }

  public enqueueGossipUpdate(update: GossipUpdate): void {
    this.gossipBuffer.set(update.nodeId, { ...update, disseminationCount: 0 });
  }

  /**
   * Selects piggyback gossip updates for outgoing packets and increments dissemination counter.
   * Evicts once dissemination reaches lambda * log(N).
   */
  public drainPiggybackUpdates(maxCount = 5, maxDisseminations = 6): GossipUpdate[] {
    const selected: GossipUpdate[] = [];
    for (const [nodeId, update] of this.gossipBuffer.entries()) {
      selected.push({ ...update });
      update.disseminationCount++;
      if (update.disseminationCount >= maxDisseminations) {
        this.gossipBuffer.delete(nodeId);
      }
      if (selected.length >= maxCount) {
        break;
      }
    }
    return selected;
  }

  public registerStatusListener(
    listener: (member: SwimMember, prevStatus: SwimMemberStatus) => void,
  ): () => void {
    this.statusListeners.push(listener);
    return () => {
      const idx = this.statusListeners.indexOf(listener);
      if (idx >= 0) this.statusListeners.splice(idx, 1);
    };
  }
}
