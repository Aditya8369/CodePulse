export type StorageClass = 'STANDARD' | 'INFREQUENT_ACCESS' | 'COLDLINE';

export interface StoredArtifact {
  key: string;
  sizeBytes: number;
  uploadedAt: number;
  currentClass: StorageClass;
  replicatedToGcs: boolean;
}

export class TieredStorageManagerService {
  private artifacts = new Map<string, StoredArtifact>();

  public uploadArtifact(key: string, sizeBytes: number, uploadedAt = Date.now()): StoredArtifact {
    const artifact: StoredArtifact = {
      key,
      sizeBytes,
      uploadedAt,
      currentClass: 'STANDARD',
      replicatedToGcs: true // Dual cloud durability
    };
    this.artifacts.set(key, artifact);
    return artifact;
  }

  public runLifecycleEvaluation(currentTime = Date.now()): { transitionedToIa: number; transitionedToCold: number } {
    let transitionedToIa = 0;
    let transitionedToCold = 0;

    for (const artifact of this.artifacts.values()) {
      const ageDays = (currentTime - artifact.uploadedAt) / (1000 * 60 * 60 * 24);

      if (ageDays >= 180 && artifact.currentClass !== 'COLDLINE') {
        artifact.currentClass = 'COLDLINE';
        transitionedToCold++;
      } else if (ageDays >= 30 && ageDays < 180 && artifact.currentClass === 'STANDARD') {
        artifact.currentClass = 'INFREQUENT_ACCESS';
        transitionedToIa++;
      }
    }

    return { transitionedToIa, transitionedToCold };
  }

  public getArtifact(key: string): StoredArtifact | undefined {
    return this.artifacts.get(key);
  }
}
