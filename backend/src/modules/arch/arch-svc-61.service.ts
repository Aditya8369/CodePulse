/**
 * Architecture Service 61: High-Speed In-Memory Inverted Index
 * Subsystem: Realtime Challenge Search
 */

export class InvertedIndexSearchService {
  private index = new Map<string, Set<string>>(); // token -> Set of documentIds

  public indexDocument(docId: string, text: string): void {
    const tokens = this.tokenize(text);
    for (const token of tokens) {
      let set = this.index.get(token);
      if (!set) {
        set = new Set();
        this.index.set(token, set);
      }
      set.add(docId);
    }
  }

  public search(query: string): string[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    let intersection: Set<string> | null = null;
    for (const token of queryTokens) {
      const docs = this.index.get(token) || new Set();
      if (!intersection) {
        intersection = new Set(docs);
      } else {
        intersection = new Set([...intersection].filter(d => docs.has(d)));
      }
    }
    return intersection ? Array.from(intersection) : [];
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length > 1);
  }
}
