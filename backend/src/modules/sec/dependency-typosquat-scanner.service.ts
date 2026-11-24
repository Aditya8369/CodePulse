export class DependencyTyposquatScannerService {
  private popularPackages = ['express', 'react', 'lodash', 'prisma', 'vitest', 'typescript'];

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  public scanPackage(packageName: string): { isTyposquat: boolean; targetPackage?: string } {
    for (const pop of this.popularPackages) {
      if (packageName !== pop) {
        const dist = this.levenshtein(packageName, pop);
        if (dist <= 2 && Math.abs(packageName.length - pop.length) <= 1) {
          return { isTyposquat: true, targetPackage: pop };
        }
      }
    }
    return { isTyposquat: false };
  }
}
