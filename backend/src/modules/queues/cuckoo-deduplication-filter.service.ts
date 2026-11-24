export class CuckooDeduplicationFilterService {
  private table1 = new Map<number, string>();
  private table2 = new Map<number, string>();
  private capacity: number;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
  }

  private hash1(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % this.capacity;
  }

  private hash2(key: string): number {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 33) ^ key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % this.capacity;
  }

  public insert(key: string): boolean {
    if (this.contains(key)) return false; // Duplicate!

    const pos1 = this.hash1(key);
    if (!this.table1.has(pos1)) {
      this.table1.set(pos1, key);
      return true;
    }

    const pos2 = this.hash2(key);
    if (!this.table2.has(pos2)) {
      this.table2.set(pos2, key);
      return true;
    }

    // Evict existing item in table1 and place into table2 (cuckoo hashing)
    const evicted = this.table1.get(pos1)!;
    this.table1.set(pos1, key);
    const posEvicted2 = this.hash2(evicted);
    this.table2.set(posEvicted2, evicted);
    return true;
  }

  public contains(key: string): boolean {
    const pos1 = this.hash1(key);
    if (this.table1.get(pos1) === key) return true;
    const pos2 = this.hash2(key);
    return this.table2.get(pos2) === key;
  }
}
