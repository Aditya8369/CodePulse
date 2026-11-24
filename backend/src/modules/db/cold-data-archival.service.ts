export interface PartitionMetadata {
  name: string;
  ageDays: number;
  recordCount: number;
}

export class ColdDataArchivalService {
  private archivalThresholdDays: number;

  constructor(archivalThresholdDays: number = 90) {
    this.archivalThresholdDays = archivalThresholdDays;
  }

  public shouldArchive(partition: PartitionMetadata): boolean {
    return partition.ageDays >= this.archivalThresholdDays;
  }

  public archivePartition(partition: PartitionMetadata): { partitionName: string; archivedRecords: number; status: string } {
    return {
      partitionName: partition.name,
      archivedRecords: partition.recordCount,
      status: 'ARCHIVED_TO_COLDLINE'
    };
  }
}
