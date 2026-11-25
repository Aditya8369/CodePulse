/**
 * Architecture Service 85: Job Execution Status Notifier
 * Subsystem: Guaranteed At-Least-Once Delivery
 */

export interface JobNotification {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  acknowledged: boolean;
  attemptCount: number;
}

export class JobStatusNotifierService {
  private notifications = new Map<string, JobNotification>();

  public createNotification(jobId: string, status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'): JobNotification {
    const notif: JobNotification = {
      jobId,
      status,
      acknowledged: false,
      attemptCount: 1,
    };
    this.notifications.set(jobId, notif);
    return notif;
  }

  public acknowledge(jobId: string): boolean {
    const notif = this.notifications.get(jobId);
    if (!notif) return false;
    notif.acknowledged = true;
    return true;
  }

  public getUnacknowledged(): JobNotification[] {
    return Array.from(this.notifications.values()).filter(n => !n.acknowledged);
  }
}
