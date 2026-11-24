import { Injectable, Logger } from '@nestjs/common';

export interface ScimUser {
  id: string;
  userName: string;
  active: boolean;
  emails: { value: string; primary: boolean }[];
}

@Injectable()
export class ScimProvisioningGatewayService {
  private readonly logger = new Logger(ScimProvisioningGatewayService.name);
  private users = new Map<string, ScimUser>();

  public createUser(user: ScimUser): ScimUser {
    this.users.set(user.id, { ...user });
    this.logger.log(`Provisioned SCIM user ${user.userName} (${user.id})`);
    return user;
  }

  public deprovisionUser(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.active = false;
    this.logger.log(`Deprovisioned SCIM user ${user.userName} (${userId})`);
    return true;
  }

  public getUser(userId: string): ScimUser | undefined {
    return this.users.get(userId);
  }
}
