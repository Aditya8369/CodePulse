export interface ResourceState {
  address: string;
  type: string;
  attributes: Record<string, any>;
}

export interface DriftReport {
  hasDrift: boolean;
  unmanagedResources: string[];
  missingResources: string[];
  modifiedAttributes: Array<{ address: string; attribute: string; expected: any; actual: any }>;
}

export class IacDriftDetectorService {
  public compareState(gitHclState: ResourceState[], liveCloudState: ResourceState[]): DriftReport {
    const gitMap = new Map<string, ResourceState>(gitHclState.map(r => [r.address, r]));
    const liveMap = new Map<string, ResourceState>(liveCloudState.map(r => [r.address, r]));

    const unmanagedResources: string[] = [];
    const missingResources: string[] = [];
    const modifiedAttributes: DriftReport['modifiedAttributes'] = [];

    // Find unmanaged resources in live cloud not in Git
    for (const [address] of liveMap.entries()) {
      if (!gitMap.has(address)) {
        unmanagedResources.push(address);
      }
    }

    // Find missing resources defined in Git but missing in cloud
    for (const [address, gitRes] of gitMap.entries()) {
      if (!liveMap.has(address)) {
        missingResources.push(address);
        continue;
      }

      // Check attribute parity
      const liveRes = liveMap.get(address)!;
      for (const [key, expectedVal] of Object.entries(gitRes.attributes)) {
        const actualVal = liveRes.attributes[key];
        if (JSON.stringify(expectedVal) !== JSON.stringify(actualVal)) {
          modifiedAttributes.push({
            address,
            attribute: key,
            expected: expectedVal,
            actual: actualVal
          });
        }
      }
    }

    const hasDrift = unmanagedResources.length > 0 || missingResources.length > 0 || modifiedAttributes.length > 0;

    return {
      hasDrift,
      unmanagedResources,
      missingResources,
      modifiedAttributes
    };
  }
}
