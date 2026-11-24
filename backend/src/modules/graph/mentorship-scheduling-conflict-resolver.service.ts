import { Injectable, Logger } from '@nestjs/common';

export interface CalendarSlot {
  mentorId: string;
  startTime: number; // epoch ms
  endTime: number;   // epoch ms
}

@Injectable()
export class MentorshipSchedulingConflictResolverService {
  private readonly logger = new Logger(MentorshipSchedulingConflictResolverService.name);
  private bookedSlots: CalendarSlot[] = [];

  public bookSession(slot: CalendarSlot): { success: boolean; error?: string } {
    const hasOverlap = this.bookedSlots.some(
      s => s.mentorId === slot.mentorId &&
           Math.max(s.startTime, slot.startTime) < Math.min(s.endTime, slot.endTime)
    );

    if (hasOverlap) {
      this.logger.warn(`Scheduling conflict detected for mentor ${slot.mentorId}`);
      return { success: false, error: 'CONFLICT_OVERLAPPING_SESSION' };
    }

    this.bookedSlots.push(slot);
    return { success: true };
  }
}
