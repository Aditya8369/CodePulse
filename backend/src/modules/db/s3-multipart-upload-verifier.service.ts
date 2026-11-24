import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

export interface UploadPart {
  partNumber: number;
  md5Checksum: string;
  sizeBytes: number;
}

@Injectable()
export class S3MultipartUploadVerifierService {
  private readonly uploads = new Map<string, Map<number, UploadPart>>();

  public recordPart(uploadId: string, part: UploadPart): void {
    let parts = this.uploads.get(uploadId);
    if (!parts) {
      parts = new Map();
      this.uploads.set(uploadId, parts);
    }
    parts.set(part.partNumber, part);
  }

  public verifyComplete(uploadId: string, expectedPartsCount: number): { complete: boolean; missingParts: number[] } {
    const parts = this.uploads.get(uploadId) || new Map();
    const missing: number[] = [];

    for (let i = 1; i <= expectedPartsCount; i++) {
      if (!parts.has(i)) missing.push(i);
    }

    return { complete: missing.length === 0, missingParts: missing };
  }
}
