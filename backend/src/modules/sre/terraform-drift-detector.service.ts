export class TerraformDriftDetectorService {
  public compareState(expectedResources: Record<string, any>, actualResources: Record<string, any>): {
    hasDrift: boolean;
    driftedKeys: string[];
  } {
    const driftedKeys: string[] = [];

    for (const [key, expVal] of Object.entries(expectedResources)) {
      if (actualResources[key] === undefined || JSON.stringify(actualResources[key]) !== JSON.stringify(expVal)) {
        driftedKeys.push(key);
      }
    }

    return {
      hasDrift: driftedKeys.length > 0,
      driftedKeys
    };
  }
}
