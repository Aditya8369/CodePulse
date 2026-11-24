import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class S3TenantPolicyAssumerService {
  private readonly logger = new Logger(S3TenantPolicyAssumerService.name);

  public generateScopedPolicy(bucketName: string, tenantId: string): object {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
          Resource: `arn:aws:s3:::${bucketName}/tenants/${tenantId}/*`
        }
      ]
    };
  }
}
