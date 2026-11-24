export interface VulnerabilityRecord {
  packageName: string;
  affectedVersion: string;
  patchedVersion: string;
  cveId: string;
}

export class AutomatedPatchSynthesizerService {
  public synthesizePatch(dependencies: Record<string, string>, advisories: VulnerabilityRecord[]): {
    updatedDependencies: Record<string, string>;
    appliedPatches: number;
  } {
    const updated = { ...dependencies };
    let count = 0;

    for (const adv of advisories) {
      if (updated[adv.packageName] === adv.affectedVersion) {
        updated[adv.packageName] = adv.patchedVersion;
        count++;
      }
    }

    return { updatedDependencies: updated, appliedPatches: count };
  }
}
